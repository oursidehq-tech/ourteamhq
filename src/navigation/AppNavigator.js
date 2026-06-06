import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  interpolate,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import {
  Home,
  Users,
  Users2,
  Calendar,
  ShoppingBag,
  Menu,
} from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { useUISettings } from "../contexts/UISettingsContext";
import {
  TabBarAnimationProvider,
  useTabBarAnimation,
} from "../contexts/TabBarAnimationContext";

import HomeScreen from "../screens/HomeScreen";
import TeamsScreen from "../screens/TeamsScreen";
import GroupsScreen from "../screens/GroupsScreen";
import GroupDetailsScreen from "../screens/GroupDetailsScreen";
import GroupMembersScreen from "../screens/GroupMembersScreen";
import CalendarScreen from "../screens/CalendarScreen";
import ShopScreen from "../screens/ShopScreen";
import MoreScreen from "../screens/MoreScreen";
import OnboardingScreen from "../screens/Auth/OnboardingScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import SignUpScreen from "../screens/Auth/SignUpScreen";
import ClubOnboardingScreen from "../screens/Auth/ClubOnboardingScreen";
import JoinClubScreen from "../screens/Auth/JoinClubScreen";
import TasksScreen from "../screens/Management/TasksScreen";
import RosteringScreen from "../screens/Management/RosteringScreen.js";
import TradesScreen from "../screens/Management/TradesScreen";
import ClubInfoScreen from "../screens/Club/ClubInfoScreen";
import PublicClubPageScreen from "../screens/Club/PublicClubPageScreen";
import SuperAdminScreen from "../screens/Platform/SuperAdminScreen";
import SuperAdminClubDetailsScreen from "../screens/Platform/SuperAdminClubDetailsScreen";
import BillingScreen from "../screens/Club/BillingScreen";
import CartScreen from "../screens/Shop/CartScreen";
import MyOrdersScreen from "../screens/Shop/MyOrdersScreen";
import OrdersDashboardScreen from "../screens/Shop/OrdersDashboardScreen";
import ProductManagerScreen from "../screens/Shop/ProductManagerScreen";
import ProductDetailScreen from "../screens/Shop/ProductDetailScreen";
import SearchScreen from "../screens/Features/SearchScreen";
import NotificationsScreen from "../screens/Features/NotificationsScreen";
import CreateItemScreen from "../screens/Features/CreateItemScreen";
import UpdatesScreen from "../screens/Features/UpdatesScreen";
import EventsScreen from "../screens/Features/EventsScreen";
import NetworkScreen from "../screens/Features/NetworkScreen";
import TeamFeedScreen from "../screens/Features/TeamFeedScreen";
import ClubOperationsScreen from "../screens/Features/ClubOperationsScreen";
import DrillsScreen from "../screens/Features/DrillsScreen";
import LeaguePlatformScreen from "../screens/Features/LeaguePlatformScreen";
import MatchesScreen from "../screens/Management/MatchesScreen";
import MatchDetailsScreen from "../screens/Management/MatchDetailsScreen";
import RoleRequestsScreen from "../screens/Management/RoleRequestsScreen";
import TeamMembersScreen from "../screens/Features/TeamMembersScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import RoleChangeRequestScreen from "../screens/Auth/RoleChangeRequestScreen";
import OrganisationScreen from "../screens/Features/OrganisationScreen";
import AdminPageScreen from "../screens/AdminPageScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG = {
  Home: { label: "Home", icon: Home },
  Teams: { label: "Teams", icon: Users },
  Groups: { label: "Groups", icon: Users2 },
  Calendar: { label: "Calendar", icon: Calendar },
  Shop: { label: "Shop", icon: ShoppingBag },
  More: { label: "More", icon: Menu },
};

function AnimatedTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { collapsed } = useTabBarAnimation();
  const { settings } = useUISettings();
  const compactMode = !!settings.compactMode;
  const reduceMotion = !!settings.reduceMotion;
  const tabCount = state.routes.length;
  const activeIndex = useSharedValue(state.index);

  React.useEffect(() => {
    if (reduceMotion) {
      activeIndex.value = state.index;
      return;
    }

    activeIndex.value = withSpring(state.index, {
      damping: 16,
      stiffness: 190,
      mass: 0.7,
    });
  }, [activeIndex, state.index, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const progress = collapsed.value;
    const sideInset = compactMode ? 20 : 28;
    const expandedWidth = Math.max(screenWidth - sideInset, 0);
    const compactWidth = Math.min(Math.max(screenWidth * 0.88, 310), 420);
    const width = interpolate(progress, [0, 1], [expandedWidth, compactWidth]);
    const expandedHeight = compactMode ? 64 : 72;
    const collapsedHeight = compactMode ? 56 : 62;

    return {
      width,
      left: (screenWidth - width) / 2,
      bottom: interpolate(
        progress,
        [0, 1],
        [insets.bottom + 16, insets.bottom + 22],
      ),
      height: interpolate(progress, [0, 1], [expandedHeight, collapsedHeight]),
      borderRadius: interpolate(progress, [0, 1], [36, 31]),
      transform: [
        { translateY: interpolate(progress, [0, 1], [0, -3]) },
        { scale: interpolate(progress, [0, 1], [1, 0.985]) },
      ],
    };
  });

  const activePillStyle = useAnimatedStyle(() => {
    const progress = collapsed.value;
    const sideInset = compactMode ? 20 : 28;
    const expandedWidth = Math.max(screenWidth - sideInset, 0);
    const compactWidth = Math.min(Math.max(screenWidth * 0.88, 310), 420);
    const containerWidth = interpolate(
      progress,
      [0, 1],
      [expandedWidth, compactWidth],
    );
    const horizontalPadding = 12;
    const trackWidth = Math.max(containerWidth - horizontalPadding, 0);
    const segmentWidth = trackWidth / Math.max(tabCount, 1);
    const pillWidth = Math.max(segmentWidth - 4, 44);

    return {
      width: pillWidth,
      transform: [{ translateX: activeIndex.value * segmentWidth + 2 }],
    };
  });

  return (
    <Animated.View style={[styles.floatingTabBar, animatedStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.activePill, activePillStyle]}
      />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key].options;
        const config = TAB_CONFIG[route.name] || TAB_CONFIG.Home;
        const IconComponent = config.icon;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tabButton}
          >
            <View style={styles.labelWrap}>
              <IconComponent
                size={compactMode ? 15 : 17}
                color={focused ? "#0A7F48" : "#7F868E"}
                strokeWidth={2.3}
              />
              <Text
                style={[
                  styles.tabLabel,
                  focused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

function BottomTabs() {
  const { userRole } = useClub();

  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        initialParams={{ role: userRole }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        initialParams={{ role: userRole }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        initialParams={{ role: userRole }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        initialParams={{ role: userRole }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        initialParams={{ role: userRole }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        initialParams={{ role: userRole }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, initializing, profile, loading } = useAuth();

  const normalizedAccountType = String(profile?.accountType || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const normalizedEmail = String(profile?.email || "").toLowerCase();
  const memberships = Array.isArray(profile?.clubMemberships)
    ? profile.clubMemberships
    : [];
  const normalizedClubId = String(profile?.clubId || "").trim();
  const isClubOwner = normalizedAccountType === "owner";
  const isSuperAdmin =
    normalizedAccountType === "superadmin" ||
    normalizedEmail === "admin@greensports.com" ||
    normalizedEmail === "admin@gmail.com";

  if (initializing || (isAuthenticated && (loading || !profile))) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#108B51" />
      </View>
    );
  }

  const canEnterClubApp = memberships.length > 0 || normalizedClubId;

  return (
    <TabBarAnimationProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            isSuperAdmin ? (
              <>
                <Stack.Screen name="SuperAdmin" component={SuperAdminScreen} />
                <Stack.Screen
                  name="SuperAdminClubDetails"
                  component={SuperAdminClubDetailsScreen}
                />
              </>
            ) : canEnterClubApp ? (
              <>
                <Stack.Screen name="Main" component={BottomTabs} />
                <Stack.Screen
                  name="Notifications"
                  component={NotificationsScreen}
                />
                <Stack.Screen name="Search" component={SearchScreen} />
                <Stack.Screen name="CreateItem" component={CreateItemScreen} />
                <Stack.Screen name="TeamFeed" component={TeamFeedScreen} />
                <Stack.Screen
                  name="TeamMembers"
                  component={TeamMembersScreen}
                />
                <Stack.Screen
                  name="ClubOperations"
                  component={ClubOperationsScreen}
                />
                <Stack.Screen
                  name="DrillLibrary"
                  component={DrillsScreen}
                />
                <Stack.Screen
                  name="LeaguePlatform"
                  component={LeaguePlatformScreen}
                />
                <Stack.Screen name="Matches" component={MatchesScreen} />
                <Stack.Screen
                  name="MatchDetails"
                  component={MatchDetailsScreen}
                />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Tasks" component={TasksScreen} />
                <Stack.Screen name="Rostering" component={RosteringScreen} />
                <Stack.Screen name="Trades" component={TradesScreen} />
                <Stack.Screen
                  name="GroupDetails"
                  component={GroupDetailsScreen}
                />
                <Stack.Screen
                  name="RoleRequests"
                  component={RoleRequestsScreen}
                />
                <Stack.Screen
                  name="GroupMembers"
                  component={GroupMembersScreen}
                />
                <Stack.Screen name="ClubInfo" component={ClubInfoScreen} />
                <Stack.Screen
                  name="PublicClubPage"
                  component={PublicClubPageScreen}
                />
                <Stack.Screen name="Billing" component={BillingScreen} />
                <Stack.Screen name="Cart" component={CartScreen} />
                <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
                <Stack.Screen
                  name="OrdersDashboard"
                  component={OrdersDashboardScreen}
                />
                <Stack.Screen
                  name="ProductManager"
                  component={ProductManagerScreen}
                />
                <Stack.Screen
                  name="ProductDetail"
                  component={ProductDetailScreen}
                />
                <Stack.Screen name="Updates" component={UpdatesScreen} />
                <Stack.Screen name="Events" component={EventsScreen} />
                <Stack.Screen name="Network" component={NetworkScreen} />
                <Stack.Screen name="AdminPage" component={AdminPageScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen
                  name="HelpSupport"
                  component={HelpSupportScreen}
                />
                <Stack.Screen
                  name="RoleChangeRequest"
                  component={RoleChangeRequestScreen}
                />
                <Stack.Screen
                  name="Organisation"
                  component={OrganisationScreen}
                />
              </>
            ) : (
              <>
                {isClubOwner ? (
                  <>
                    <Stack.Screen
                      name="ClubOnboarding"
                      component={ClubOnboardingScreen}
                    />
                    <Stack.Screen name="JoinClub" component={JoinClubScreen} />
                  </>
                ) : (
                  <>
                    <Stack.Screen name="JoinClub" component={JoinClubScreen} />
                    <Stack.Screen
                      name="ClubOnboarding"
                      component={ClubOnboardingScreen}
                    />
                  </>
                )}
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen
                  name="PublicClubPage"
                  component={PublicClubPageScreen}
                />
              </>
            )
          ) : (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
              <Stack.Screen name="JoinClub" component={JoinClubScreen} />
              <Stack.Screen
                name="ClubOnboarding"
                component={ClubOnboardingScreen}
              />
              <Stack.Screen
                name="PublicClubPage"
                component={PublicClubPageScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </TabBarAnimationProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  floatingTabBar: {
    position: "absolute",
    backgroundColor: "#FCFDFF",
    borderWidth: 1,
    borderColor: "#E8EDF2",
    elevation: 20,
    shadowColor: "#1E2C2A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6,
    overflow: "hidden",
  },
  activePill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEDE3",
    shadowColor: "#108B51",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 1,
  },
  tabButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    height: "92%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
  tabLabelActive: {
    color: "#0A7F48",
  },
  tabLabelInactive: {
    color: "#7F868E",
  },
});
