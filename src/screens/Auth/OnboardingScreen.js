import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, FlatList, Image, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Run Your Club Like a Pro',
        description: 'Manage rosters, assign tasks, and communicate with your entire organization in one place.',
        image: 'https://images.unsplash.com/photo-1431324155629-1a6fb1ce8f4d?q=80&w=800&auto=format&fit=crop'
    },
    {
        id: '2',
        title: 'Premium Official Gear',
        description: 'Shop the latest kits, training apparel, and accessories directly connecting you to the team.',
        image: 'https://images.unsplash.com/photo-1510566337590-2fc1f21100aa?q=80&w=800&auto=format&fit=crop'
    },
    {
        id: '3',
        title: 'Never Miss a Moment',
        description: 'Stay instantly updated with interactive schedules, match reminders, and live club news.',
        image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=800&auto=format&fit=crop'
    }
];

export default function OnboardingScreen({ navigation }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [failedImageIds, setFailedImageIds] = useState({});
    const flatListRef = useRef(null);

    useEffect(() => {
        SLIDES.forEach((slide) => {
            if (slide?.image) {
                Image.prefetch(slide.image).catch(() => {
                    // Network image prefetch can fail on some devices; fallback is handled in render.
                });
            }
        });
    }, []);

    const viewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const onNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            navigation.replace('Login');
        }
    };

    const onSkip = () => {
        navigation.replace('Login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.skipContainer}>
                <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                    <Text variant="small" weight="600" color={theme.colors.textSecondary}>Skip</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.slide}>
                        <View style={styles.animationContainer}>
                            <Image
                                source={
                                    failedImageIds[item.id]
                                        ? require('../../../assets/splash.png')
                                        : { uri: item.image }
                                }
                                style={styles.heroImage}
                                resizeMode="cover"
                                onError={() =>
                                    setFailedImageIds((prev) => ({
                                        ...prev,
                                        [item.id]: true,
                                    }))
                                }
                            />
                            <View style={styles.imageOverlay} />
                        </View>
                        <View style={styles.contentContainer}>
                            <Text variant="h1" style={styles.title}>{item.title}</Text>
                            <Text variant="body" color={theme.colors.textSecondary} style={styles.description}>
                                {item.description}
                            </Text>
                        </View>
                    </View>
                )}
            />

            <View style={styles.footer}>
                {/* Paginator */}
                <View style={styles.paginator}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index && styles.dotActive
                            ]}
                        />
                    ))}
                </View>

                <Button
                    title={currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
                    onPress={onNext}
                    icon={currentIndex < SLIDES.length - 1 ? <ChevronRight color={theme.colors.white} size={20} /> : null}
                    style={styles.nextButton}
                    textStyle={styles.nextButtonText}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.surface,
    },
    skipContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        zIndex: 10,
    },
    skipButton: {
        padding: theme.spacing.sm,
    },
    slide: {
        width,
        alignItems: 'center',
    },
    animationContainer: {
        width: width,
        height: height * 0.45,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing.xl,
        overflow: 'hidden',
    },
    heroImage: {
        width: width * 0.88,
        height: height * 0.38,
        borderRadius: theme.radius.xl,
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        marginHorizontal: width * 0.06,
        borderRadius: theme.radius.xl,
        backgroundColor: 'rgba(0,0,0,0.14)',
    },
    contentContainer: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.md,
        color: theme.colors.primaryDark,
    },
    description: {
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 0 : theme.spacing.xl,
        marginTop: 'auto',
    },
    paginator: {
        flexDirection: 'row',
        height: 40,
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.border,
        marginHorizontal: 4,
    },
    dotActive: {
        width: 24,
        backgroundColor: theme.colors.primary,
    },
    nextButton: {
        flexDirection: 'row-reverse',
        paddingHorizontal: theme.spacing.xl,
    },
    nextButtonText: {
        marginLeft: 0,
        marginRight: 8,
    }
});
