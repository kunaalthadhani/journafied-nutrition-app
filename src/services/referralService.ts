import { dataStorage, ReferralCode, ReferralRedemption, ReferralReward } from './dataStorage';
import * as Device from 'expo-device';
import { analyticsService } from './analyticsService';
import * as Notifications from 'expo-notifications';
import { notificationService } from './notificationService';
import { generateId } from '../utils/uuid';

/**
 * Generates a unique alphanumeric referral code (8-10 uppercase characters)
 * Ensures uniqueness by checking against existing codes in storage
 */
async function generateUniqueReferralCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 8 + Math.floor(Math.random() * 3); // Random length between 8-10
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < codeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists
    const existing = await dataStorage.getReferralCodeByCode(code);
    if (!existing) {
      return code;
    }
  }

  // If we couldn't generate a unique code after max attempts, add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const baseCode = Array(6)
    .fill(0)
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');
  return baseCode + timestamp;
}

export const referralService = {
  /**
   * Get or create a referral code for a user
   * If user already has a code, return it. Otherwise, generate and save a new one.
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    try {
      // Check if user has existing code
      const existing = await dataStorage.getReferralCode(userId);
      if (existing) {
        return existing.code;
      }

      // Generate new code
      const code = await generateUniqueReferralCode();
      const referralCode: ReferralCode = {
        code,
        userId,
        createdAt: new Date().toISOString(),
        totalReferrals: 0,
        totalEarnedEntries: 0,
      };

      // Save the new code
      await dataStorage.saveReferralCode(referralCode);
      // Track analytics
      await analyticsService.trackReferralCodeGenerated(userId);
      return code;
    } catch (error) {
      console.error('Error getting or creating referral code:', error);
      throw error;
    }
  },

  /**
   * Validate a referral code format (alphanumeric, 8-10 chars)
   */
  validateReferralCodeFormat(code: string): boolean {
    const regex = /^[A-Z0-9]{8,10}$/;
    return regex.test(code.toUpperCase());
  },

  /**
   * Check if a referral code exists and is valid
   */
  async validateReferralCode(
    code: string
  ): Promise<{ valid: boolean; referralCode: ReferralCode | null; error?: string }> {
    // Check format
    if (!this.validateReferralCodeFormat(code)) {
      return {
        valid: false,
        referralCode: null,
        error: 'Invalid code format. Code must be 8-10 alphanumeric characters.',
      };
    }

    // Check if code exists in storage
    const referralCode = await dataStorage.getReferralCodeByCode(code);
    if (!referralCode) {
      return {
        valid: false,
        referralCode: null,
        error: 'Referral code not found.',
      };
    }

    return { valid: true, referralCode };
  },

  /**
   * Validate a referral code for redemption (check format, existence, self-referral, already used)
   */
  async validateReferralCodeForRedemption(
    code: string,
    userEmail: string
  ): Promise<{ valid: boolean; referralCode: ReferralCode | null; error?: string }> {
    // 1. Validate format
    if (!this.validateReferralCodeFormat(code)) {
      return { valid: false, referralCode: null, error: 'Invalid code format' };
    }

    // 2. Check if code exists
    const referralCode = await dataStorage.getReferralCodeByCode(code);
    if (!referralCode) {
      return { valid: false, referralCode: null, error: 'Referral code not found' };
    }

    // 3. Prevent self-referral (compare userId with userEmail)
    if (referralCode.userId.toLowerCase() === userEmail.toLowerCase()) {
      return {
        valid: false,
        referralCode: null,
        error: 'You cannot use your own referral code',
      };
    }

    // 4. Check if user has already used a referral code
    const hasUsed = await dataStorage.checkIfUserHasUsedReferralCode(userEmail);
    if (hasUsed) {
      return {
        valid: false,
        referralCode: null,
        error: 'You have already used a referral code',
      };
    }

    return { valid: true, referralCode };
  },

  /**
   * Create a referral redemption record
   */
  async createReferralRedemption(
    referralCode: ReferralCode,
    refereeEmail: string,
    refereeName: string
  ): Promise<ReferralRedemption> {
    const deviceId = Device.modelName || 'unknown';
    const redemptionId = generateId();

    const redemption: ReferralRedemption = {
      id: redemptionId,
      referralCode: referralCode.code,
      referrerEmail: referralCode.userId,
      refereeEmail: refereeEmail,
      refereeName: refereeName,
      redeemedAt: new Date().toISOString(),
      status: 'pending',
      mealsLogged: 0,
      deviceId: deviceId,
    };

    // Check for potential fraud — block if suspicious
    const fraudCheck = await this.detectPotentialFraud(deviceId);
    if (fraudCheck.suspicious) {
      console.warn('[Referral] Fraud blocked:', fraudCheck.message);
      throw new Error('This device has been flagged for suspicious referral activity. Redemption blocked.');
    }

    await dataStorage.saveReferralRedemption(redemption);

    // Track analytics
    await analyticsService.trackReferralCodeRedeemed(referralCode.code, refereeEmail);

    return redemption;
  },

  /**
   * Check rate limits for referral rewards (max 5 per week, 10 per month)
   */
  async checkReferralRateLimit(userId: string): Promise<{ canRefer: boolean; reason?: string }> {
    const redemptions = await dataStorage.getReferralRedemptionsForUser(userId, 'referrer');
    const completedRedemptions = redemptions.filter((r) => r.status === 'completed');

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyCount = completedRedemptions.filter(
      (r) => new Date(r.completedAt || r.redeemedAt) >= oneWeekAgo
    ).length;

    const monthlyCount = completedRedemptions.filter(
      (r) => new Date(r.completedAt || r.redeemedAt) >= oneMonthAgo
    ).length;

    if (weeklyCount >= 5) {
      return {
        canRefer: false,
        reason: 'You have reached your weekly referral limit (5). Try again next week.',
      };
    }

    if (monthlyCount >= 10) {
      return {
        canRefer: false,
        reason: 'You have reached your monthly referral limit (10). Try again next month.',
      };
    }

    return { canRefer: true };
  },

  /**
   * Process meal logging and check if rewards should be awarded
   * Call this after each meal is logged
   */
  async processMealLoggingProgress(userEmail: string): Promise<{
    rewardsAwarded: boolean;
    entriesAwarded?: number;
    message?: string;
  }> {
    // Find pending redemption for this user
    const redemptions = await dataStorage.getReferralRedemptionsForUser(userEmail, 'referee');
    const pendingRedemption = redemptions.find((r) => r.status === 'pending');

    if (!pendingRedemption) {
      return { rewardsAwarded: false };
    }

    // Increment meals logged
    const updatedMealsLogged = pendingRedemption.mealsLogged + 1;
    await dataStorage.updateReferralRedemption(pendingRedemption.id, {
      mealsLogged: updatedMealsLogged,
    });

    // Check if 5 meals reached
    if (updatedMealsLogged >= 5) {
      // Idempotency guard: check if rewards were already awarded for this redemption
      const existingRewards = await dataStorage.getReferralRewardsForRedemption(pendingRedemption.id);
      if (existingRewards && existingRewards.length > 0) {
        return { rewardsAwarded: false, message: 'Rewards already awarded for this referral.' };
      }

      // Mark as completed FIRST to prevent concurrent duplicate awards
      await dataStorage.updateReferralRedemption(pendingRedemption.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // Award rewards to both referrer and referee
      const rateLimitCheck = await this.checkReferralRateLimit(pendingRedemption.referrerEmail);

      if (!rateLimitCheck.canRefer) {
        // Award to referee only (referrer is rate limited)
        const refereeReward: ReferralReward = {
          id: generateId(),
          userId: pendingRedemption.refereeEmail,
          earnedAt: new Date().toISOString(),
          entriesAwarded: 10,
          reason: 'referee_reward',
          relatedRedemptionId: pendingRedemption.id,
        };
        await dataStorage.saveReferralReward(refereeReward);

        // Track analytics
        await analyticsService.trackReferralRewardEarned(
          pendingRedemption.refereeEmail,
          10,
          'referee'
        );

        return {
          rewardsAwarded: true,
          entriesAwarded: 10,
          message:
            'You earned +10 free entries! Your friend has reached their referral limit, so they did not receive a reward.',
        };
      }

      // Award to referee
      const refereeReward: ReferralReward = {
        id: generateId(),
        userId: pendingRedemption.refereeEmail,
        earnedAt: new Date().toISOString(),
        entriesAwarded: 10,
        reason: 'referee_reward',
        relatedRedemptionId: pendingRedemption.id,
      };
      await dataStorage.saveReferralReward(refereeReward);

      // Award to referrer
      const referrerReward: ReferralReward = {
        id: generateId(),
        userId: pendingRedemption.referrerEmail,
        earnedAt: new Date().toISOString(),
        entriesAwarded: 10,
        reason: 'referrer_reward',
        relatedRedemptionId: pendingRedemption.id,
      };
      await dataStorage.saveReferralReward(referrerReward);

      // Track analytics
      await analyticsService.trackReferralRewardEarned(
        pendingRedemption.refereeEmail,
        10,
        'referee'
      );
      await analyticsService.trackReferralRewardEarned(
        pendingRedemption.referrerEmail,
        10,
        'referrer'
      );

      // Send push notification to referrer
      try {
        const refereeName = pendingRedemption.refereeName || 'A friend';
        await notificationService.sendReferralRewardNotification(
          pendingRedemption.referrerEmail,
          refereeName
        );
      } catch (error) {
        console.error('Error sending referral reward notification:', error);
        // Don't fail the reward process if notification fails
      }

      // Update referral code stats
      const referralCode = await dataStorage.getReferralCodeByCode(
        pendingRedemption.referralCode
      );
      if (referralCode) {
        await dataStorage.updateReferralCode(referralCode.userId, {
          totalReferrals: referralCode.totalReferrals + 1,
          totalEarnedEntries: referralCode.totalEarnedEntries + 10,
        });
      }

      return {
        rewardsAwarded: true,
        entriesAwarded: 10,
        message: `You've earned +10 free entries! Your friend ${referralCode?.userId || 'friend'} also received +10 entries.`,
      };
    }

    return {
      rewardsAwarded: false,
      message: `Keep logging meals! ${5 - updatedMealsLogged} more to unlock your referral bonus.`,
    };
  },

  /**
   * Detect potential fraud (same device using multiple codes)
   * This is for logging/analytics - doesn't block, but flags for review
   */
  async detectPotentialFraud(deviceId: string): Promise<{
    suspicious: boolean;
    redemptionsCount: number;
    message?: string;
  }> {
    const allRedemptions = await dataStorage.loadReferralRedemptions();
    const deviceRedemptions = allRedemptions.filter((r) => r.deviceId === deviceId);

    // If same device has 3+ redemptions, flag as suspicious
    if (deviceRedemptions.length >= 3) {
      return {
        suspicious: true,
        redemptionsCount: deviceRedemptions.length,
        message: `Device ${deviceId} has ${deviceRedemptions.length} referral redemptions`,
      };
    }

    return { suspicious: false, redemptionsCount: deviceRedemptions.length };
  },
};

