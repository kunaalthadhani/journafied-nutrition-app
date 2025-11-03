import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { ParsedFood } from '../utils/foodNutrition';

interface FoodLogSectionProps {
  foods: ParsedFood[];
  onRemoveFood: (foodId: string) => void;
}

export const FoodLogSection: React.FC<FoodLogSectionProps> = ({ foods, onRemoveFood }) => {
  if (foods.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Today's Food Log</Text>
      
      {foods.map((food) => (
        <View key={food.id} style={styles.foodItem}>
          <View style={styles.foodHeader}>
            <View style={styles.foodInfo}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodQuantity}>
                {food.quantity} {food.unit} ({food.weight_g}g)
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => onRemoveFood(food.id)}
            >
              <Feather name="x" size={16} color={Colors.secondaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.nutritionInfo}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{food.calories}</Text>
              <Text style={styles.nutritionLabel}>cal</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{food.protein}g</Text>
              <Text style={styles.nutritionLabel}>protein</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{food.carbs}g</Text>
              <Text style={styles.nutritionLabel}>carbs</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{food.fat}g</Text>
              <Text style={styles.nutritionLabel}>fat</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    marginBottom: 16,
  },
  foodItem: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    marginBottom: 4,
  },
  foodQuantity: {
    fontSize: Typography.fontSize.sm,
    color: Colors.secondaryText,
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primaryText,
    marginBottom: 2,
  },
  nutritionLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.secondaryText,
    textAlign: 'center',
  },
});