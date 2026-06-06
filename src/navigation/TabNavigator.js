import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Users, Calendar, ShoppingBag, Menu } from "lucide-react-native";
import { theme } from "../theme/theme";

import HomeScreen from "../screens/HomeScreen";
import TeamsScreen from "../screens/TeamsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import ShopScreen from "../screens/ShopScreen";
import MoreScreen from "../screens/MoreScreen";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 58,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarIconStyle: {
          flex: 1,
          marginTop: 0,
          marginBottom: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Home color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Users color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Calendar color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ShoppingBag color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Menu color={color} size={22} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
