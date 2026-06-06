import React from 'react';
import { Text as RNText } from 'react-native';
import { theme } from '../../theme/theme';

export const Text = ({
    variant = 'body',
    color = theme.colors.text,
    align = 'left',
    weight,
    style,
    children,
    ...props
}) => {
    const baseStyle = theme.typography[variant] || theme.typography.body;

    return (
        <RNText
            style={[
                baseStyle,
                { color, textAlign: align },
                weight && { fontWeight: weight },
                style
            ]}
            {...props}
        >
            {children}
        </RNText>
    );
};
