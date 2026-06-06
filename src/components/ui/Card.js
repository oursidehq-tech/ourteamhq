import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

export const Card = ({ children, style, noPadding = false, ...props }) => {
    return (
        <View
            style={[
                styles.card,
                !noPadding && styles.padding,
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        ...theme.shadows.small,
        marginVertical: theme.spacing.sm,
    },
    padding: {
        padding: theme.spacing.md,
    },
});
