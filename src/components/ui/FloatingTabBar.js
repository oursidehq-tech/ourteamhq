import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Users, Users2, Calendar, ShoppingBag, Menu } from "lucide-react-native";
import { useClub } from "../../contexts/ClubContext";

const TABS = [
  { name: "Home",     label: "Home",     icon: Home,        screen: "Home" },
  { name: "Teams",   label: "Teams",    icon: Users,       screen: "Teams" },
  { name: "Groups",  label: "Groups",   icon: Users2,      screen: "Groups" },
  { name: "Calendar",label: "Calendar", icon: Calendar,    screen: "Calendar" },
  { name: "Shop",    label: "Shop",     icon: ShoppingBag, screen: "Shop" },
  { name: "More",    label: "More",     icon: Menu,        screen: "More" },
];

/**
 * FloatingTabBar — mirrors the exact appearance of the main app's animated
 * bottom tab bar. Use this inside stack screens so they feel consistent.
 *
 * @param {object} props
 * @param {object} props.navigation — React Navigation navigation prop
 * @param {string} [props.activeScreen] — highlight a tab by name (optional)
 */
export default function FloatingTabBar({ navigation, activeScreen }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { userRole } = useClub();

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const showGroups = normalizedRole !== "player" && normalizedRole !== "parent";

  const visibleTabs = TABS.filter(
    (t) => t.name !== "Groups" || showGroups
  );

  const sideInset = 28;
  const maxBarWidth = screenWidth >= 900 ? 760 : 680;
  const barWidth = Math.min(Math.max(screenWidth - sideInset, 0), maxBarWidth);
  const tabCount = visibleTabs.length;

  // Calculate pill position for the active screen
  const activeIdx = visibleTabs.findIndex((t) => t.screen === activeScreen);
  const segmentWidth = (barWidth - 12) / Math.max(tabCount, 1);
  const pillWidth = Math.max(segmentWidth - 4, 44);
  const pillLeft = activeIdx >= 0 ? activeIdx * segmentWidth + 2 : -999;

  return (
    <View
      style={[
        styles.floatingTabBar,
        {
          width: barWidth,
          left: (screenWidth - barWidth) / 2,
          bottom: insets.bottom + 16,
          height: 72,
          borderRadius: 36,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Active pill */}
      {activeIdx >= 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.activePill,
            { width: pillWidth, left: pillLeft },
          ]}
        />
      )}

      {visibleTabs.map((tab) => {
        const focused = tab.screen === activeScreen;
        const IconComponent = tab.icon;

        return (
          <Pressable
            key={tab.name}
            style={styles.tabButton}
            onPress={() => {
              // Navigate back to Main tabs and switch to the target screen
              navigation.navigate("Main", { screen: tab.screen });
            }}
          >
            <View style={styles.labelWrap}>
              <IconComponent
                size={15}
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
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingTabBar: {
    position: "absolute",
    backgroundColor: "rgba(252,253,255,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
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
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(16, 139, 81, 0.14)",
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
    outlineStyle: "none",
  },
  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0,
  },
  tabLabelActive: {
    color: "#0A7F48",
  },
  tabLabelInactive: {
    color: "#7F868E",
  },
});
