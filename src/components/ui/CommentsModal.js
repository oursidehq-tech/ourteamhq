import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Send, Trash2 } from "lucide-react-native";
import { theme } from "../../theme/theme";

export const CommentsModal = ({
  visible,
  onClose,
  post,
  currentUserId,
  onAddComment,
  onDeleteComment,
  formatTime,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const modalHeight = Math.min(Math.max(screenHeight * 0.72, 420), screenHeight * 0.88);
  const keyboardOffset = Platform.OS === "ios" ? insets.top + 8 : 20;
  const inputBottomPadding =
    Math.max(insets.bottom, theme.spacing.sm) +
    (Platform.OS === "android" ? 20 : 12);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddComment(post, commentText);
      setCommentText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const comments = Array.isArray(post?.comments) ? post.comments : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View style={[styles.modalContent, { height: modalHeight }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={theme.colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {comments.length === 0 ? (
              <Text style={styles.emptyText}>Be the first to comment!</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentName}>{comment.name}</Text>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentTime}>
                        {formatTime
                          ? formatTime(comment.createdAt)
                          : "Just now"}
                      </Text>
                      {currentUserId === comment.uid && (
                        <TouchableOpacity
                          style={styles.commentDeleteBtn}
                          onPress={() => onDeleteComment(post, comment)}
                        >
                          <Trash2 color={theme.colors.error} size={14} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={[
              styles.inputArea,
              { paddingBottom: inputBottomPadding },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={theme.colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !commentText.trim() && styles.sendBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!commentText.trim() || isSubmitting}
            >
              <Send
                color={
                  commentText.trim()
                    ? theme.colors.white
                    : theme.colors.textSecondary
                }
                size={18}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    padding: theme.spacing.md,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
  },
  commentItem: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  commentName: {
    fontWeight: "600",
    color: theme.colors.text,
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  commentTime: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  commentDeleteBtn: {
    marginLeft: 8,
  },
  commentText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
