import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Typography';
import { theme } from '../../theme/theme';

export const Badge = ({ text, variant = 'primary', icon, style }) => {
    const isOutline = variant === 'outline';

    return (
        <View style={[
            styles.badge,
            isOutline ? styles.outline : styles.solid,
            style
        ]}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
                variant="small"
                color={isOutline ? theme.colors.textSecondary : theme.colors.primary}
                weight="600"
            >
                {text}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.radius.full,
        alignSelf: 'flex-start',
    },
    solid: {
        backgroundColor: theme.colors.secondary, // Light green
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    iconContainer: {
        marginRight: 4,
    }
});
