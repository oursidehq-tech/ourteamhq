import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MapPin,
  Mail,
  Phone,
  Link2,
  Edit2,
  Trash2,
  Copy,
  Share2,
  Key,
  Users,
  UserCog,
  ChevronDown,
  Camera,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import {
  getClubMembers,
  updateMemberRole,
  removeClubMember,
  updateClub,
  renameClubAndSyncMemberships,
  subscribeToRoleChangeRequests,
  approveRoleChangeRequest,
  rejectRoleChangeRequest,
} from "../../services/clubService";
import {
  uploadClubLogo,
  uploadClubBanner,
} from "../../services/storageService";
import {
  subscribeToGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from "../../services/managementService";
import { getTeams, assignMembersToTeam } from "../../services/teamService";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";

export default function ClubInfoScreen({ route, navigation }) {
  const { activeClub, activeClubId, userRole, activeMembership } = useClub();

  const normalizedUserRoles = (() => {
    const fromMembership = Array.isArray(activeMembership?.roles)
      ? activeMembership.roles
      : [];
    const fromSingleRole = activeMembership?.role
      ? [activeMembership.role]
      : userRole
        ? [userRole]
        : [];

    return Array.from(
      new Set(
        [...fromMembership, ...fromSingleRole]
          .map((role) =>
            String(role || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
  })();

  const isOwner = normalizedUserRoles.includes("owner");
  const isAdmin = isOwner || normalizedUserRoles.includes("admin");
  const canManageGroups =
    isAdmin ||
    normalizedUserRoles.some((role) => ["coach", "manager"].includes(role));
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [editingClubName, setEditingClubName] = useState(false);
  const [clubNameDraft, setClubNameDraft] = useState("");
  const [savingClubName, setSavingClubName] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupTypeDraft, setGroupTypeDraft] = useState("Staff");
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [rolePickerMember, setRolePickerMember] = useState(null);
  const [rolePickerSelection, setRolePickerSelection] = useState([]);
  const [savingRole, setSavingRole] = useState(false);
  const [roleChangeRequests, setRoleChangeRequests] = useState([]);

  const club = activeClub || {};
  const contact = club.contact || {};
  const keyPeople = club.keyPeople || [];
  const contactVisibility = {
    location: club.contactVisibility?.location || "public",
    website: club.contactVisibility?.website || "public",
    phone: club.contactVisibility?.phone || "members",
    email: club.contactVisibility?.email || "members",
  };

  // Roles that can be assigned — Owner can assign Admin, Admin cannot assign Owner or Admin
  const ROLES = isOwner
    ? [
        "Player",
        "Parent",
        "Coach",
        "Manager",
        "Volunteer",
        "Committee",
        "Executive",
        "Admin",
      ]
    : [
        "Player",
        "Parent",
        "Coach",
        "Manager",
        "Volunteer",
        "Committee",
        "Executive",
      ];

  const GROUP_TYPES = [
    "Staff",
    "Executive",
    "Committee",
    "Open Volunteers",
    "Team",
  ];

  const getMemberRoles = (member) => {
    const explicitRoles = Array.isArray(member?.roles)
      ? member.roles.map((role) => String(role || "").trim()).filter(Boolean)
      : [];

    if (explicitRoles.length) {
      return Array.from(new Set(explicitRoles));
    }

    const singleRole = String(member?.role || "").trim();
    return singleRole ? [singleRole] : ["Player"];
  };

  const getMemberRoleLabel = (member) => getMemberRoles(member).join(", ");

  const getPrimaryRoleForMember = (member) => {
    const roles = getMemberRoles(member);
    if (roles.includes("Owner")) return "Owner";
    if (roles.includes("Admin")) return "Admin";
    return roles[0] || "Player";
  };

  useEffect(() => {
    if (isAdmin && activeClubId) {
      setLoadingMembers(true);
      getClubMembers(activeClubId)
        .then(setMembers)
        .catch(() => {})
        .finally(() => setLoadingMembers(false));
    }
  }, [isAdmin, activeClubId]);

  useEffect(() => {
    if (!isAdmin || !activeClubId) return;
    const unsub = subscribeToRoleChangeRequests(activeClubId, (reqs) => {
      setRoleChangeRequests(reqs || []);
    });
    return () => unsub?.();
  }, [isAdmin, activeClubId]);

  const handleApproveRoleChange = async (req) => {
    const requestedLabel = Array.isArray(req?.requestedRoles)
      ? req.requestedRoles.filter(Boolean).join(", ")
      : req?.requestedRole || "";
    try {
      await approveRoleChangeRequest(activeClubId, req);
      Alert.alert(
        "Approved",
        `${req.userName}'s role changed to ${requestedLabel || "the requested roles"}.`,
      );
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not approve request.");
    }
  };

  const handleRejectRoleChange = async (req) => {
    const requestedLabel = Array.isArray(req?.requestedRoles)
      ? req.requestedRoles.filter(Boolean).join(", ")
      : req?.requestedRole || "";
    Alert.alert(
      "Reject Request",
      `Reject ${req.userName}'s request to become ${requestedLabel || "the requested roles"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await rejectRoleChangeRequest(activeClubId, req.userId);
              Alert.alert("Rejected", "Role change request rejected.");
            } catch (e) {
              Alert.alert("Error", e?.message || "Could not reject request.");
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!editingClubName) {
      setClubNameDraft(club.name || "");
    }
  }, [club.name, editingClubName]);

  useEffect(() => {
    if (!canManageGroups || !activeClubId) {
      setGroups([]);
      return;
    }

    setLoadingGroups(true);
    const unsubscribe = subscribeToGroups(activeClubId, (rows) => {
      setGroups(Array.isArray(rows) ? rows : []);
      setLoadingGroups(false);
    });

    return () => unsubscribe?.();
  }, [canManageGroups, activeClubId]);

  useEffect(() => {
    if (!isAdmin || !activeClubId) {
      setTeams([]);
      return;
    }

    getTeams(activeClubId)
      .then((rows) => setTeams(Array.isArray(rows) ? rows : []))
      .catch(() => setTeams([]));
  }, [isAdmin, activeClubId]);

  const handleSaveClubName = async () => {
    const nextName = (clubNameDraft || "").trim();
    if (!activeClubId) {
      Alert.alert("Error", "No active club selected.");
      return;
    }
    if (!nextName) {
      Alert.alert("Required", "Club name is required.");
      return;
    }
    if (nextName === (club.name || "").trim()) {
      setEditingClubName(false);
      return;
    }

    setSavingClubName(true);
    try {
      await renameClubAndSyncMemberships(activeClubId, nextName);
      setEditingClubName(false);
      Alert.alert("Saved", "Club name updated successfully.");
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to update club name.");
    } finally {
      setSavingClubName(false);
    }
  };

  const promptTeamAssignmentIfNeeded = (member, roles) => {
    const normalizedRoles = (Array.isArray(roles) ? roles : [roles])
      .map((role) =>
        String(role || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const teamRole = normalizedRoles.find((role) =>
      ["coach", "manager"].includes(role),
    );
    if (!teamRole) return;

    const teamRoleLabel =
      (Array.isArray(roles) ? roles : [roles]).find(
        (role) =>
          String(role || "")
            .trim()
            .toLowerCase() === String(teamRole),
      ) || teamRole;

    if (!Array.isArray(teams) || teams.length === 0) {
      Alert.alert(
        "No Teams Found",
        "Create a team first, then assign this member to that team.",
      );
      return;
    }

    const options = teams.slice(0, 20).map((team) => ({
      text: team.name || "Unnamed Team",
      onPress: async () => {
        try {
          await assignMembersToTeam(activeClubId, team.id, [member.id]);
          setMembers((prev) =>
            prev.map((m) => {
              if (m.id !== member.id) return m;
              const existing = Array.isArray(m.teamIds) ? m.teamIds : [];
              return {
                ...m,
                teamIds: existing.includes(team.id)
                  ? existing
                  : [...existing, team.id],
              };
            }),
          );
          Alert.alert(
            "Team Assigned",
            `${member.displayName} assigned to ${team.name}.`,
          );
        } catch {
          Alert.alert("Error", "Failed to assign member to team.");
        }
      },
    }));
    options.push({ text: "Skip", style: "cancel" });
    Alert.alert(
      "Assign Team",
      `Select a team for ${member.displayName} (${teamRoleLabel}).`,
      options,
    );
  };

  const handleToggleRole = (role) => {
    if (savingRole) return;
    setRolePickerSelection((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSaveRoles = async () => {
    if (!rolePickerMember || savingRole) return;

    const selectedRoles = Array.from(
      new Set(
        rolePickerSelection
          .map((role) => String(role || "").trim())
          .filter(Boolean),
      ),
    );

    if (!selectedRoles.length) {
      Alert.alert("Required", "Select at least one role.");
      return;
    }

    const currentRoles = getMemberRoles(rolePickerMember);
    const sameSelection =
      currentRoles.length === selectedRoles.length &&
      currentRoles.every((role) => selectedRoles.includes(role));
    if (sameSelection) {
      setRolePickerMember(null);
      setRolePickerSelection([]);
      return;
    }

    setSavingRole(true);
    try {
      await updateMemberRole(activeClubId, rolePickerMember.id, selectedRoles);
      const primaryRole = selectedRoles.includes("Owner")
        ? "Owner"
        : selectedRoles.includes("Admin")
          ? "Admin"
          : selectedRoles[0];
      setMembers((prev) =>
        prev.map((m) =>
          m.id === rolePickerMember.id
            ? { ...m, role: primaryRole, roles: selectedRoles }
            : m,
        ),
      );
      const currentMember = rolePickerMember;
      setRolePickerMember(null);
      setRolePickerSelection([]);
      Alert.alert(
        "Updated",
        `${currentMember.displayName} now has roles: ${selectedRoles.join(", ")}.`,
      );
      promptTeamAssignmentIfNeeded(currentMember, selectedRoles);
    } catch {
      Alert.alert("Error", "Failed to update role.");
    } finally {
      setSavingRole(false);
    }
  };

  const handleChangeRole = (member) => {
    setRolePickerMember(member);
    setRolePickerSelection(getMemberRoles(member));
  };

  const handleRemoveMember = (member) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${member.displayName} from this club?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeClubMember(activeClubId, member.id);
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
              Alert.alert("Removed", `${member.displayName} has been removed.`);
            } catch (e) {
              Alert.alert("Error", "Failed to remove member.");
            }
          },
        },
      ],
    );
  };

  const getRoleBadgeColor = (role) => {
    if (role === "Owner") return theme.colors.warning || "#F5A623";
    if (role === "Admin") return "#E74C3C";
    if (role === "Executive") return "#C0392B";
    if (role === "Committee") return "#D35400";
    if (role === "Coach") return theme.colors.info || "#007AFF";
    if (role === "Manager") return "#8E44AD";
    if (role === "Parent") return theme.colors.secondary || "#5856D6";
    if (role === "Volunteer") return "#27AE60";
    return theme.colors.primary;
  };

  const managedGroups = groups.filter(
    (group) => String(group?.source || "").toLowerCase() !== "team",
  );

  const resetGroupForm = () => {
    setEditingGroupId(null);
    setGroupNameDraft("");
    setGroupTypeDraft("Staff");
  };

  const handleSaveGroup = async () => {
    const nextName = String(groupNameDraft || "").trim();
    const nextType = String(groupTypeDraft || "").trim() || "Staff";

    if (!activeClubId) {
      Alert.alert("Error", "No active club selected.");
      return;
    }
    if (!nextName) {
      Alert.alert("Required", "Group name is required.");
      return;
    }

    try {
      if (editingGroupId) {
        await updateGroup(activeClubId, editingGroupId, {
          groupName: nextName,
          groupType: nextType,
        });
        Alert.alert("Updated", "Group updated successfully.");
      } else {
        await createGroup(activeClubId, {
          groupName: nextName,
          groupType: nextType,
        });
        Alert.alert("Created", "Group created successfully.");
      }
      resetGroupForm();
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to save group.");
    }
  };

  const handleEditGroup = (group) => {
    if (!group) return;
    setEditingGroupId(group.id);
    setGroupNameDraft(group.groupName || "");
    setGroupTypeDraft(group.groupType || "Staff");
  };

  const handleCycleGroupType = () => {
    const idx = GROUP_TYPES.findIndex(
      (type) =>
        String(type || "").toLowerCase() ===
        String(groupTypeDraft || "").toLowerCase(),
    );
    const nextIndex = idx >= 0 ? (idx + 1) % GROUP_TYPES.length : 0;
    setGroupTypeDraft(GROUP_TYPES[nextIndex]);
  };

  const handleDeleteGroup = (group) => {
    if (!group?.id || !activeClubId) return;

    if (
      group.system === true ||
      String(group.source || "").toLowerCase() === "team"
    ) {
      Alert.alert(
        "Protected Group",
        "System and team-linked groups cannot be deleted.",
      );
      return;
    }

    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete ${group.groupName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroup(activeClubId, group.id);
              Alert.alert("Deleted", "Group deleted successfully.");
            } catch (e) {
              Alert.alert("Error", e?.message || "Failed to delete group.");
            }
          },
        },
      ],
    );
  };

  const handleOpenGroupsTab = (group) => {
    navigation.navigate("Main", {
      screen: "Groups",
      params: {
        selectedGroupId: String(group?.groupId || group?.id || ""),
      },
    });
  };

  const handleToggleContactVisibility = async (field) => {
    if (!isAdmin || !activeClubId) return;
    const next = contactVisibility[field] === "public" ? "members" : "public";
    try {
      await updateClub(activeClubId, {
        contactVisibility: {
          ...contactVisibility,
          [field]: next,
        },
      });
    } catch {
      Alert.alert("Error", "Could not update visibility setting.");
    }
  };

  const handlePickAndUpload = async (type) => {
    if (!isAdmin || !activeClubId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
      aspect: type === "banner" ? [16, 9] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSavingMedia(true);
    try {
      const uri = result.assets[0].uri;
      const url =
        type === "banner"
          ? await uploadClubBanner(activeClubId, uri)
          : await uploadClubLogo(activeClubId, uri);
      if (!url) {
        Alert.alert(
          "Storage Disabled",
          "Image upload is disabled in free mode. Set EXPO_PUBLIC_ENABLE_STORAGE=true after enabling Firebase Storage.",
        );
        return;
      }
      await updateClub(
        activeClubId,
        type === "banner" ? { bannerUrl: url } : { logoUrl: url },
      );
    } catch {
      Alert.alert("Upload Failed", `Unable to update ${type}.`);
    } finally {
      setSavingMedia(false);
    }
  };

  const handleAddKeyPersonFromMembers = () => {
    if (!isAdmin || !members.length) {
      Alert.alert("No Members", "Add members first, then assign key people.");
      return;
    }
    const options = members.slice(0, 12).map((member) => ({
      text: member.displayName || member.email || "Member",
      onPress: async () => {
        try {
          const already = keyPeople.find((k) => k.uid === member.id);
          if (already) {
            Alert.alert(
              "Already Added",
              "This member is already listed in key people.",
            );
            return;
          }
          await updateClub(activeClubId, {
            keyPeople: [
              ...keyPeople,
              {
                name: member.displayName || member.email || "Member",
                role: member.role || "Committee",
                uid: member.id,
              },
            ],
          });
        } catch {
          Alert.alert("Error", "Could not add key person.");
        }
      },
    }));
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Add Key Person", "Select a club member:", options);
  };

  const handleUpdateKeyPersonRole = (person, idx) => {
    if (!isAdmin) return;
    const roleOptions = [
      "President",
      "Secretary",
      "Treasurer",
      "Owner",
      "Admin",
      "Coach",
      "Manager",
    ];
    const actions = roleOptions.map((role) => ({
      text: role + (person.role === role ? " ✓" : ""),
      onPress: async () => {
        try {
          const updated = keyPeople.map((p, i) =>
            i === idx ? { ...p, role } : p,
          );
          await updateClub(activeClubId, { keyPeople: updated });
        } catch {
          Alert.alert("Error", "Failed to update key person role.");
        }
      },
    }));
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Update Role", `Change role for ${person.name}:`, actions);
  };

  const handleRemoveKeyPerson = (idx) => {
    if (!isAdmin) return;
    Alert.alert("Remove Key Person", "Remove this person from key people?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const updated = keyPeople.filter((_, i) => i !== idx);
            await updateClub(activeClubId, { keyPeople: updated });
          } catch {
            Alert.alert("Error", "Failed to remove key person.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h2">Club Info</Text>
        {isAdmin && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {savingMedia ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                Saving...
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => handlePickAndUpload("logo")}
              style={styles.editBtn}
            >
              <Camera color={theme.colors.primary} size={20} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.bannerContainer}>
          <Image
            source={
              club.bannerUrl
                ? { uri: club.bannerUrl }
                : {
                    uri: "https://images.unsplash.com/photo-1518605368461-1ee11b6ecbe4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
                  }
            }
            style={styles.banner}
          />
          {isAdmin && (
            <TouchableOpacity
              style={styles.bannerEditBtn}
              onPress={() => handlePickAndUpload("banner")}
            >
              <Camera color={theme.colors.white} size={16} />
              <Text
                variant="small"
                color={theme.colors.white}
                weight="600"
                style={{ marginLeft: 6 }}
              >
                Edit Banner
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.logoContainer}>
            <Avatar
              source={
                club.logoUrl
                  ? { uri: club.logoUrl }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name || "Club")}&background=108B51&color=fff&size=150`,
                    }
              }
              size={80}
              isClub
            />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text variant="h1" style={{ flex: 1 }}>
                {club.name || "Club Name"}
              </Text>
              {isAdmin && !editingClubName ? (
                <TouchableOpacity
                  onPress={() => setEditingClubName(true)}
                  style={styles.smallActionBtn}
                >
                  <Edit2 color={theme.colors.primary} size={14} />
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                    style={{ marginLeft: 6 }}
                  >
                    Edit Name
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isAdmin && editingClubName ? (
              <View style={styles.clubNameEditor}>
                <TextInput
                  style={styles.clubNameInput}
                  value={clubNameDraft}
                  onChangeText={setClubNameDraft}
                  placeholder="Enter club name"
                  editable={!savingClubName}
                />
                <View style={styles.clubNameActions}>
                  <TouchableOpacity
                    style={[styles.smallActionBtn, styles.secondaryActionBtn]}
                    onPress={() => {
                      setClubNameDraft(club.name || "");
                      setEditingClubName(false);
                    }}
                    disabled={savingClubName}
                  >
                    <Text variant="small" weight="600">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallActionBtn}
                    onPress={handleSaveClubName}
                    disabled={savingClubName}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="600"
                    >
                      {savingClubName ? "Saving..." : "Save Name"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4 }}
            >
              {club.location || "Location not set"}
            </Text>
          </View>

          {/* Invite Code Card — visible to Owner & Admin */}
          {isAdmin && club.inviteCode && (
            <Card
              style={[
                styles.sectionCard,
                { borderWidth: 1, borderColor: theme.colors.primary + "40" },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: theme.spacing.sm,
                }}
              >
                <Key color={theme.colors.primary} size={20} />
                <Text variant="h4" style={{ marginLeft: 8 }}>
                  Club Invite Code
                </Text>
              </View>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.md }}
              >
                Share this code with players, coaches and parents so they can
                join your club during sign-up.
              </Text>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeText}>{club.inviteCode}</Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  marginTop: theme.spacing.md,
                }}
              >
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={async () => {
                    try {
                      if (Clipboard.setStringAsync) {
                        await Clipboard.setStringAsync(club.inviteCode);
                      }
                      Alert.alert(
                        "Copied!",
                        `Invite code ${club.inviteCode} copied to clipboard.`,
                      );
                    } catch {
                      Alert.alert("Invite Code", club.inviteCode);
                    }
                  }}
                >
                  <Copy color={theme.colors.primary} size={16} />
                  <Text
                    variant="body"
                    weight="600"
                    color={theme.colors.primary}
                    style={{ marginLeft: 6 }}
                  >
                    Copy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inviteBtn}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Join ${club.name || "our club"} on OurTeamHQ! Use invite code: ${club.inviteCode}`,
                      });
                    } catch (e) {
                      // user cancelled
                    }
                  }}
                >
                  <Share2 color={theme.colors.primary} size={16} />
                  <Text
                    variant="body"
                    weight="600"
                    color={theme.colors.primary}
                    style={{ marginLeft: 6 }}
                  >
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          <Card style={styles.sectionCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              About Us
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ lineHeight: 20 }}
            >
              {club.description || "No description available yet."}
            </Text>
          </Card>

          <Card style={styles.sectionCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
              Contact Details
            </Text>

            {club.location ? (
              <View style={styles.contactRow}>
                <MapPin color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={{ marginLeft: 12, flex: 1 }}>
                  {club.location}
                </Text>
                {isAdmin ? (
                  <TouchableOpacity
                    onPress={() => handleToggleContactVisibility("location")}
                    style={styles.visibilityBtn}
                  >
                    {contactVisibility.location === "public" ? (
                      <Eye color={theme.colors.primary} size={16} />
                    ) : (
                      <EyeOff color={theme.colors.textSecondary} size={16} />
                    )}
                    <Text
                      variant="small"
                      color={
                        contactVisibility.location === "public"
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                      style={{ marginLeft: 4 }}
                    >
                      {contactVisibility.location}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {contact.phone ? (
              <View style={styles.contactRow}>
                <Phone color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={{ marginLeft: 12, flex: 1 }}>
                  {contact.phone}
                </Text>
                {isAdmin ? (
                  <TouchableOpacity
                    onPress={() => handleToggleContactVisibility("phone")}
                    style={styles.visibilityBtn}
                  >
                    {contactVisibility.phone === "public" ? (
                      <Eye color={theme.colors.primary} size={16} />
                    ) : (
                      <EyeOff color={theme.colors.textSecondary} size={16} />
                    )}
                    <Text
                      variant="small"
                      color={
                        contactVisibility.phone === "public"
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                      style={{ marginLeft: 4 }}
                    >
                      {contactVisibility.phone}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {contact.email ? (
              <View style={styles.contactRow}>
                <Mail color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={{ marginLeft: 12, flex: 1 }}>
                  {contact.email}
                </Text>
                {isAdmin ? (
                  <TouchableOpacity
                    onPress={() => handleToggleContactVisibility("email")}
                    style={styles.visibilityBtn}
                  >
                    {contactVisibility.email === "public" ? (
                      <Eye color={theme.colors.primary} size={16} />
                    ) : (
                      <EyeOff color={theme.colors.textSecondary} size={16} />
                    )}
                    <Text
                      variant="small"
                      color={
                        contactVisibility.email === "public"
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                      style={{ marginLeft: 4 }}
                    >
                      {contactVisibility.email}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {club.website ? (
              <View
                style={[
                  styles.contactRow,
                  { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
                ]}
              >
                <Link2 color={theme.colors.textSecondary} size={20} />
                <Text variant="body" style={{ marginLeft: 12, flex: 1 }}>
                  {club.website}
                </Text>
                {isAdmin ? (
                  <TouchableOpacity
                    onPress={() => handleToggleContactVisibility("website")}
                    style={styles.visibilityBtn}
                  >
                    {contactVisibility.website === "public" ? (
                      <Eye color={theme.colors.primary} size={16} />
                    ) : (
                      <EyeOff color={theme.colors.textSecondary} size={16} />
                    )}
                    <Text
                      variant="small"
                      color={
                        contactVisibility.website === "public"
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                      style={{ marginLeft: 4 }}
                    >
                      {contactVisibility.website}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Card>

          {(keyPeople.length > 0 || isAdmin) && (
            <Card style={styles.sectionCard}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: theme.spacing.md,
                }}
              >
                <Text variant="h4">Key People</Text>
                {isAdmin ? (
                  <TouchableOpacity
                    style={styles.smallActionBtn}
                    onPress={handleAddKeyPersonFromMembers}
                  >
                    <UserPlus color={theme.colors.primary} size={14} />
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="600"
                      style={{ marginLeft: 6 }}
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {keyPeople.map((person, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.personRow,
                    idx < keyPeople.length - 1 && {
                      marginBottom: theme.spacing.sm,
                    },
                  ]}
                  onPress={() =>
                    isAdmin && handleUpdateKeyPersonRole(person, idx)
                  }
                  onLongPress={() => isAdmin && handleRemoveKeyPerson(idx)}
                >
                  <Avatar
                    source={{
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=108B51&color=fff&size=150`,
                    }}
                    size={40}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text variant="h4">{person.name}</Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {person.role}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {keyPeople.length === 0 ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  No key people listed yet.
                </Text>
              ) : null}
            </Card>
          )}

          {canManageGroups && (
            <Card style={styles.sectionCard}>
              <View style={styles.groupsHeaderRow}>
                <Text variant="h4">Groups</Text>
                {editingGroupId ? (
                  <TouchableOpacity
                    style={styles.smallActionBtn}
                    onPress={resetGroupForm}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      weight="600"
                    >
                      Cancel Edit
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                Create, rename and manage non-team groups for this club.
              </Text>

              <View style={styles.groupEditorRow}>
                <TextInput
                  value={groupNameDraft}
                  onChangeText={setGroupNameDraft}
                  placeholder="Group name"
                  style={styles.groupInput}
                />
                <TouchableOpacity
                  style={styles.groupTypeButton}
                  onPress={handleCycleGroupType}
                >
                  <Text
                    variant="small"
                    weight="600"
                    color={theme.colors.primary}
                  >
                    {groupTypeDraft}
                  </Text>
                  <ChevronDown color={theme.colors.primary} size={14} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.groupSaveButton}
                onPress={handleSaveGroup}
              >
                <Text variant="small" color={theme.colors.white} weight="700">
                  {editingGroupId ? "Update Group" : "Create Group"}
                </Text>
              </TouchableOpacity>

              {loadingGroups ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  Loading groups...
                </Text>
              ) : managedGroups.length === 0 ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  No custom groups yet.
                </Text>
              ) : (
                managedGroups.map((group, idx) => (
                  <View
                    key={group.id}
                    style={[
                      styles.groupListRow,
                      idx < managedGroups.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, paddingRight: theme.spacing.sm }}
                      onPress={() => handleOpenGroupsTab(group)}
                    >
                      <Text variant="h4">
                        {group.groupName || "Unnamed Group"}
                      </Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {group.groupType || "Staff"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleEditGroup(group)}
                    >
                      <Edit2 color={theme.colors.primary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleDeleteGroup(group)}
                    >
                      <Trash2 color={theme.colors.error} size={16} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Card>
          )}

          {/* Members Management — Admin Only */}
          {isAdmin && (
            <Card style={styles.sectionCard}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: theme.spacing.md,
                }}
              >
                <Users color={theme.colors.primary} size={20} />
                <Text variant="h4" style={{ marginLeft: 8 }}>
                  Club Members ({members.length})
                </Text>
              </View>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.md }}
              >
                Tap a member to approve or change their role, including
                Committee and Executive. Long-press to remove.
              </Text>
              {loadingMembers ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  Loading members...
                </Text>
              ) : members.length === 0 ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  No members yet. Share your invite code to get started.
                </Text>
              ) : (
                members.map((member, idx) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberRow,
                      idx < members.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => handleChangeRole(member)}
                    onLongPress={() => handleRemoveMember(member)}
                  >
                    {(() => {
                      const assignedTeamIds = Array.isArray(member.teamIds)
                        ? member.teamIds
                        : [];
                      const assignedTeamNames = assignedTeamIds
                        .map(
                          (teamId) =>
                            teams.find((t) => t.id === teamId)?.name || null,
                        )
                        .filter(Boolean);

                      return (
                        <>
                          <Avatar
                            source={{
                              uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName || "User")}&background=108B51&color=fff&size=150`,
                            }}
                            size={40}
                          />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text variant="h4">
                              {member.displayName || "Unknown"}
                            </Text>
                            <Text
                              variant="small"
                              color={theme.colors.textSecondary}
                            >
                              {member.email || ""}
                            </Text>
                            {assignedTeamNames.length > 0 ? (
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                                style={{ marginTop: 2 }}
                              >
                                Teams: {assignedTeamNames.join(", ")}
                              </Text>
                            ) : null}
                          </View>
                          <View
                            style={[
                              styles.roleBadge,
                              {
                                backgroundColor:
                                  getRoleBadgeColor(
                                    getPrimaryRoleForMember(member),
                                  ) + "20",
                              },
                            ]}
                          >
                            <Text
                              variant="small"
                              weight="600"
                              color={getRoleBadgeColor(
                                getPrimaryRoleForMember(member),
                              )}
                            >
                              {getMemberRoleLabel(member)}
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </TouchableOpacity>
                ))
              )}
            </Card>
          )}

          {/* Role Change Requests — Admin Only */}
          {isAdmin && roleChangeRequests.length > 0 && (
            <Card style={styles.sectionCard}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: theme.spacing.md,
                }}
              >
                <UserCog color={theme.colors.warning || "#F5A623"} size={20} />
                <Text variant="h4" style={{ marginLeft: 8 }}>
                  Pending Role Requests ({roleChangeRequests.length})
                </Text>
              </View>
              {roleChangeRequests.map((req, idx) => (
                <View
                  key={req.id}
                  style={[
                    styles.memberRow,
                    idx < roleChangeRequests.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.border,
                    },
                    {
                      alignItems: "flex-start",
                      paddingVertical: theme.spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                    <Text variant="h4">{req.userName || "User"}</Text>
                    <Text variant="small" style={{ marginTop: 4 }}>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        Current:{" "}
                      </Text>
                      <Text variant="small" weight="600">
                        {req.currentRole || "None"}
                      </Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {" "}
                        → Requested:{" "}
                      </Text>
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.primary}
                      >
                        {(Array.isArray(req.requestedRoles)
                          ? req.requestedRoles.filter(Boolean).join(", ")
                          : req.requestedRole) || "None"}
                      </Text>
                    </Text>
                    {req.reason ? (
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 6, fontStyle: "italic" }}
                      >
                        "{req.reason}"
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "column", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.smallActionBtn}
                      onPress={() => handleApproveRoleChange(req)}
                    >
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        weight="600"
                      >
                        Approve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallActionBtn,
                        { backgroundColor: "#FFF5F5" },
                      ]}
                      onPress={() => handleRejectRoleChange(req)}
                    >
                      <Text
                        variant="small"
                        color={theme.colors.error}
                        weight="600"
                      >
                        Reject
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!rolePickerMember}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRolePickerMember(null);
          setRolePickerSelection([]);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text variant="h4">Change Role</Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{
                marginTop: theme.spacing.xs,
                marginBottom: theme.spacing.md,
              }}
            >
              {`Select one or more roles for ${rolePickerMember?.displayName || "member"}:`}
            </Text>

            {ROLES.map((role) => {
              const selected = rolePickerSelection.includes(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.modalRoleItem,
                    selected && styles.modalRoleItemSelected,
                  ]}
                  onPress={() => handleToggleRole(role)}
                  disabled={savingRole}
                >
                  <Text
                    variant="small"
                    weight={selected ? "700" : "500"}
                    color={selected ? theme.colors.primary : theme.colors.text}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { alignSelf: "flex-end", marginTop: theme.spacing.sm },
              ]}
              onPress={handleSaveRoles}
              disabled={savingRole}
            >
              <Text variant="small" color={theme.colors.primary}>
                {savingRole ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { alignSelf: "flex-end", marginTop: theme.spacing.xs },
              ]}
              onPress={() => {
                setRolePickerMember(null);
                setRolePickerSelection([]);
              }}
              disabled={savingRole}
            >
              <Text variant="small" color={theme.colors.textSecondary}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  editBtn: {
    padding: theme.spacing.xs,
  },
  bannerContainer: {
    position: "relative",
    marginBottom: 50, // Space for the overlapping logo
  },
  banner: {
    width: "100%",
    height: 160,
    backgroundColor: theme.colors.border,
  },
  bannerEditBtn: {
    position: "absolute",
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  logoContainer: {
    position: "absolute",
    bottom: -40,
    left: theme.spacing.lg,
    padding: 4,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    ...theme.shadows.small,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  titleSection: {
    marginBottom: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  clubNameEditor: {
    marginTop: theme.spacing.sm,
  },
  clubNameInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 15,
  },
  clubNameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  visibilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  secondaryActionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteCodeBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: "dashed",
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  inviteCodeText: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 8,
    color: theme.colors.primary,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary + "15",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  groupsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  groupEditorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  groupInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  groupTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary + "40",
    backgroundColor: theme.colors.primary + "12",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: 6,
  },
  groupSaveButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  groupListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  iconActionBtn: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  modalRoleItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  modalRoleItemSelected: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}15`,
  },
});
