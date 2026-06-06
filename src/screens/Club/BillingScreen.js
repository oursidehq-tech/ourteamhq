import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Text } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme/theme';
import { useClub } from '../../contexts/ClubContext';

export default function BillingScreen() {
    const { activeClub } = useClub();
    const currentPlan = activeClub?.plan || 'Growth';
    const status = activeClub?.billingStatus || 'Active';

    const plans = [
        {
            name: 'Starter',
            price: '$49/mo',
            features: ['Up to 50 members', 'Basic Team Management', 'Public Club Page']
        },
        {
            name: 'Growth',
            price: '$99/mo',
            features: ['Up to 250 members', 'Task & Roster Management', 'Merch Store (3% fee)'],
            popular: true
        },
        {
            name: 'Premium',
            price: '$199/mo',
            features: ['Unlimited members', 'API Access', 'Merch Store (0% fee)', 'Priority Support']
        }
    ];

    const handleManageBilling = () => {
        Alert.alert('Stripe Billing Portal', 'Redirecting to Stripe Customer Portal to update card details and download invoices.');
    };

    const handleChangePlan = (planName) => {
        if (planName === currentPlan) return;
        Alert.alert(
            'Change Subscription',
            `Stripe billing integration coming soon. You would switch to the ${planName} plan.`,
            [{ text: 'OK' }]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text variant="h2">Billing</Text>
                    <Text variant="small" style={{ marginTop: 2 }}>Subscription & Invoices</Text>
                </View>
                <TouchableOpacity onPress={handleManageBilling} style={styles.portalBtn}>
                    <Text variant="body" weight="600" color={theme.colors.primary}>Manage Portal</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Current Status */}
                <Card style={[styles.statusCard, status === 'Past Due' && styles.statusCardError]}>
                    <View style={styles.statusHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {status === 'Active' ? (
                                <CheckCircle2 color={theme.colors.success} size={24} />
                            ) : (
                                <AlertCircle color={theme.colors.error} size={24} />
                            )}
                            <View style={{ marginLeft: theme.spacing.md }}>
                                <Text variant="h4">Current Plan: {currentPlan}</Text>
                                <Text variant="small" color={status === 'Past Due' ? theme.colors.error : theme.colors.textSecondary} style={{ marginTop: 2 }}>
                                    Status: {status} • Next billing date: 1 Nov 2026
                                </Text>
                            </View>
                        </View>
                    </View>
                    {status === 'Past Due' && (
                        <Button
                            title="Update Payment Method"
                            size="small"
                            style={{ marginTop: theme.spacing.md, backgroundColor: theme.colors.error }}
                            onPress={handleManageBilling}
                        />
                    )}
                </Card>

                {/* Available Plans */}
                <Text variant="h3" style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.lg }}>Available Plans</Text>

                {plans.map((plan) => {
                    const isActive = currentPlan === plan.name;
                    return (
                        <Card key={plan.name} style={[styles.planCard, isActive && styles.activePlanCard]}>
                            {plan.popular && (
                                <View style={styles.popularBadge}>
                                    <Text variant="small" color={theme.colors.white} weight="700" style={{ fontSize: 10 }}>MOST POPULAR</Text>
                                </View>
                            )}
                            <View style={styles.planHeader}>
                                <View>
                                    <Text variant="h3">{plan.name}</Text>
                                    <Text variant="h2" color={theme.colors.primary} style={{ marginTop: 4 }}>{plan.price}</Text>
                                </View>
                                {isActive ? (
                                    <View style={styles.currentBadge}>
                                        <Text variant="small" color={theme.colors.primary} weight="600">Current Plan</Text>
                                    </View>
                                ) : (
                                    <Button
                                        title={plan.name === 'Starter' ? 'Downgrade' : 'Upgrade'}
                                        variant="outline"
                                        size="small"
                                        onPress={() => handleChangePlan(plan.name)}
                                    />
                                )}
                            </View>

                            <View style={styles.featuresList}>
                                {plan.features.map((feature, idx) => (
                                    <View key={idx} style={styles.featureRow}>
                                        <CheckCircle2 color={theme.colors.textSecondary} size={16} />
                                        <Text variant="body" color={theme.colors.textSecondary} style={{ marginLeft: 8 }}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        </Card>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    portalBtn: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    content: {
        padding: theme.spacing.md,
        paddingBottom: 160,
    },
    statusCard: {
        borderColor: theme.colors.success,
        borderWidth: 1,
        backgroundColor: 'rgba(16, 139, 81, 0.05)',
    },
    statusCardError: {
        borderColor: theme.colors.error,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    planCard: {
        marginBottom: theme.spacing.lg,
        position: 'relative',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    activePlanCard: {
        borderColor: theme.colors.primary,
        borderWidth: 2,
    },
    popularBadge: {
        position: 'absolute',
        top: -10,
        right: theme.spacing.lg,
        backgroundColor: theme.colors.secondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: theme.radius.full,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingBottom: theme.spacing.md,
        marginBottom: theme.spacing.md,
    },
    currentBadge: {
        backgroundColor: 'rgba(16, 139, 81, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: theme.radius.full,
    },
    featuresList: {
        paddingTop: theme.spacing.xs,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
});
