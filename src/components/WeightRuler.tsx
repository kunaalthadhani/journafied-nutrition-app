import React, { useRef, useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Acid } from '../constants/acid';

const TICK_W = 10;
const STEP = 0.1;

interface WeightRulerProps {
  min: number;
  max: number;
  initialValue: number;
  onChange: (value: number) => void;
}

// A tape-measure picker: drag left/right, the lime needle reads the weight.
// One tick per 0.1 unit, tall marks on whole numbers, labels every integer.
export const WeightRuler: React.FC<WeightRulerProps> = ({ min, max, initialValue, onChange }) => {
  const [width, setWidth] = useState(0);
  const listRef = useRef<FlatList>(null);
  const count = Math.round((max - min) / STEP) + 1;
  const ticks = useRef(Array.from({ length: count }, (_, i) => i)).current;
  const clampedInitial = Math.min(max, Math.max(min, initialValue));
  const initialIndex = Math.round((clampedInitial - min) / STEP);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / TICK_W);
    const clamped = Math.max(0, Math.min(count - 1, idx));
    onChange(Math.round((min + clamped * STEP) * 10) / 10);
  }, [count, min, onChange]);

  const sidePad = Math.max(0, width / 2 - TICK_W / 2);

  return (
    <View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <FlatList
            ref={listRef}
            horizontal
            data={ticks}
            keyExtractor={i => String(i)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_W}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={handleScroll}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({ length: TICK_W, offset: TICK_W * index, index })}
            contentContainerStyle={{ paddingHorizontal: sidePad, alignItems: 'flex-end' }}
            style={{ height: 74 }}
            renderItem={({ item: i }) => {
              const value = min + i * STEP;
              const isInt = i % 10 === 0;
              const isHalf = i % 5 === 0;
              return (
                <View style={{ width: TICK_W, alignItems: 'center', justifyContent: 'flex-end', height: 74 }}>
                  {isInt && (
                    <Text style={styles.tickLabel}>{Math.round(value)}</Text>
                  )}
                  <View
                    style={{
                      width: isInt ? 2 : 1,
                      height: isInt ? 30 : isHalf ? 20 : 12,
                      backgroundColor: isInt ? Acid.tx2 : Acid.hair2,
                    }}
                  />
                </View>
              );
            }}
          />
          {/* the needle */}
          <View pointerEvents="none" style={[styles.needle, { left: width / 2 - 1 }]} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 74,
    justifyContent: 'flex-end',
  },
  tickLabel: {
    fontSize: 10,
    color: Acid.tx3,
    marginBottom: 6,
  },
  needle: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    height: 44,
    borderRadius: 1,
    backgroundColor: Acid.lime,
    shadowColor: Acid.lime,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
});
