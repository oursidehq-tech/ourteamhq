import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Text } from './Typography';
import { theme } from '../../theme/theme';

export const SegmentedControl = ({ options, selectedIndex, onChange }) => {
    return (
        <View style={styles.container}>
            {options.map((option, index) => {
                const isSelected = selectedIndex === index;
                return (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.segment,
                            isSelected && styles.segmentSelected
                        ]}
                        onPress={() => onChange(index)}
                        activeOpacity={0.8}
                    >
                        <Text
                            variant="small"
                            weight="600"
                            color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                        >
                            {option}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.xs,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    segment: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        alignItems: 'center',
        borderRadius: theme.radius.full,
    },
    segmentSelected: {
        backgroundColor: '#F0FAF5', // Very light green for active segment
    },
});
