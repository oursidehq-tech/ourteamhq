import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { theme } from "../../theme/theme";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hr = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const ampm = hr < 12 ? "AM" : "PM";
  const h = hr % 12 === 0 ? 12 : hr % 12;
  const hm = h.toString() /* no padding to look native e.g. 9:00 AM */;
  return `${hm}:${min} ${ampm}`;
});

export const TimePickerModal = ({ visible, onClose, onSelect, selectedTime, title = "Select Time" }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.closeBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={TIME_OPTIONS}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                  const isSelected = item === selectedTime;
                  return (
                    <TouchableOpacity
                      style={[styles.timeRow, isSelected && styles.timeRowSelected]}
                      onPress={() => {
                        onSelect(item);
                        onClose();
                      }}
                    >
                      <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "50%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  closeBtn: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  listContainer: {
    paddingBottom: theme.spacing.xl,
  },
  timeRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
    alignItems: "center",
  },
  timeRowSelected: {
    backgroundColor: "rgba(16, 139, 81, 0.1)",
  },
  timeText: {
    fontSize: 18,
    color: theme.colors.text,
  },
  timeTextSelected: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});
