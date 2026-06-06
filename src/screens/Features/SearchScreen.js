import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, FlatList, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search as SearchIcon, X, Clock, Users, Calendar, ShoppingBag, FileText } from 'lucide-react-native';
import { Text } from '../../components/ui/Typography';
import { theme } from '../../theme/theme';
import { useClub } from '../../contexts/ClubContext';
import { getPosts } from '../../services/postService';
import { getTeams } from '../../services/teamService';
import { getEvents } from '../../services/eventService';
import { getProducts } from '../../services/shopService';

export default function SearchScreen({ navigation }) {
    const { activeClubId } = useClub();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);

    const handleSearch = async () => {
        Keyboard.dismiss();
        const q = query.trim().toLowerCase();
        if (!q || !activeClubId) return;

        if (!recentSearches.includes(query.trim())) {
            setRecentSearches([query.trim(), ...recentSearches].slice(0, 10));
        }

        setSearching(true);
        try {
            const [posts, teams, events, products] = await Promise.all([
                getPosts(activeClubId),
                getTeams(activeClubId),
                getEvents(activeClubId),
                getProducts(activeClubId),
            ]);

            const matched = [];

            posts.forEach(p => {
                if (p.content?.toLowerCase().includes(q) || p.authorName?.toLowerCase().includes(q)) {
                    matched.push({ id: p.id, type: 'Post', title: p.content?.substring(0, 60) || 'Post', subtitle: p.authorName || '' });
                }
            });

            teams.forEach(t => {
                if (t.name?.toLowerCase().includes(q) || t.ageGroup?.toLowerCase().includes(q)) {
                    matched.push({ id: t.id, type: 'Team', title: t.name, subtitle: t.ageGroup || '' });
                }
            });

            events.forEach(e => {
                if (e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q)) {
                    matched.push({ id: e.id, type: 'Event', title: e.title, subtitle: e.date || '' });
                }
            });

            products.forEach(p => {
                if (p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)) {
                    matched.push({ id: p.id, type: 'Product', title: p.name, subtitle: `$${p.price || 0}` });
                }
            });

            setResults(matched);
        } catch (err) {
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const removeRecent = (searchQuery) => {
        setRecentSearches(recentSearches.filter(q => q !== searchQuery));
    };

    const getResultIcon = (type) => {
        switch (type) {
            case 'Post': return <FileText color={theme.colors.primary} size={20} />;
            case 'Team': return <Users color={theme.colors.primary} size={20} />;
            case 'Event': return <Calendar color={theme.colors.primary} size={20} />;
            case 'Product': return <ShoppingBag color={theme.colors.primary} size={20} />;
            default: return <FileText color={theme.colors.primary} size={20} />;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft color={theme.colors.text} size={28} />
                </TouchableOpacity>
                <View style={styles.searchBar}>
                    <SearchIcon color={theme.colors.textSecondary} size={20} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search events, gear, members..."
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        autoFocus
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <X color={theme.colors.textSecondary} size={20} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.content}>
                {query.length > 0 ? (
                    results.length > 0 ? (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => `${item.type}-${item.id}`}
                            renderItem={({ item }) => (
                                <View style={styles.resultItem}>
                                    <View style={styles.resultIcon}>{getResultIcon(item.type)}</View>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="body" weight="600" numberOfLines={1}>{item.title}</Text>
                                        <Text variant="small" color={theme.colors.textSecondary}>{item.type}{item.subtitle ? ` • ${item.subtitle}` : ''}</Text>
                                    </View>
                                </View>
                            )}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <SearchIcon color={theme.colors.border} size={48} />
                            <Text variant="h3" style={{ marginTop: theme.spacing.md }}>{searching ? 'Searching...' : 'No results found'}</Text>
                            <Text variant="body" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
                                {searching ? '' : 'Try adjusting your search terms'}
                            </Text>
                        </View>
                    )
                ) : (
                    <View>
                        <Text variant="h3" style={{ marginBottom: theme.spacing.md }}>Recent Searches</Text>
                        <FlatList
                            data={recentSearches}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <View style={styles.recentItem}>
                                    <TouchableOpacity style={styles.recentRow} onPress={() => setQuery(item)}>
                                        <Clock color={theme.colors.textSecondary} size={20} />
                                        <Text variant="body" style={styles.recentText}>{item}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => removeRecent(item)}>
                                        <X color={theme.colors.textSecondary} size={20} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    </View>
                )}
            </View>
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
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backBtn: {
        marginRight: theme.spacing.md,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.spacing.md,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: theme.spacing.sm,
        fontSize: 16,
        color: theme.colors.text,
    },
    content: {
        flex: 1,
        padding: theme.spacing.xl,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    recentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    recentText: {
        marginLeft: theme.spacing.md,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    resultIcon: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        backgroundColor: 'rgba(16, 139, 81, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.md,
    },
});
