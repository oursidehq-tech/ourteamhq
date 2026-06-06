import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Typography';
import { theme } from '../../theme/theme';

export const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    icon,
    loading = false,
    disabled = false,
    style,
    textStyle,
}) => {
    const isOutline = variant === 'outline';
    const textVariant = size === 'small' ? 'small' : 'h4';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.button,
                styles[`${size}Size`],
                isOutline ? styles.outlineVariant : styles.primaryVariant,
                disabled && styles.disabled,
                style,
            ]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={isOutline ? theme.colors.primary : theme.colors.white} />
            ) : (
                <>
                    {icon && icon}
                    {title && (
                        <Text
                            variant={textVariant}
                            weight="600"
                            color={isOutline ? theme.colors.primary : theme.colors.white}
                            style={[icon && { marginLeft: theme.spacing.sm }, textStyle]}
                        >
                            {title}
                        </Text>
                    )}
                </>
            )}
        </TouchableOpacity>
    );
};

export const FAB = ({ onPress, icon, style }) => {
    const insets = useSafeAreaInsets();
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.fab, { bottom: insets.bottom + 140 }, style]}
            activeOpacity={0.9}
        >
            {icon}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full, // Pill shape like in mockups
    },
    mediumSize: {
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
    },
    smallSize: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
    },
    primaryVariant: {
        backgroundColor: theme.colors.primary,
    },
    outlineVariant: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    disabled: {
        opacity: 0.5,
    },
    fab: {
        position: 'absolute',
        right: theme.spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.medium,
    }
});
