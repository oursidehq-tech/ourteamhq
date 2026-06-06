import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

export const Avatar = ({ source, size = 40, style, isClub = false }) => {
    return (
        <View style={[
            styles.container,
            { width: size, height: size, borderRadius: isClub ? theme.radius.md : size / 2 },
            style
        ]}>
            <Image
                source={source}
                style={[
                    styles.image,
                    { width: size, height: size, borderRadius: isClub ? theme.radius.md : size / 2 }
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
    },
    image: {
        resizeMode: 'cover',
    },
});
