import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { getClub, subscribeToClub } from "../services/clubService";

const EXECUTIVE_ROLES = new Set([
  "owner",
  "admin",
  "president",
  "vice president",
  "vice-president",
  "executive",
]);

const COMMITTEE_ROLES = new Set([
  "committee",
  "treasurer",
  "secretary",
  "registrar",
  "coordinator",
]);

const ROLE_PRIORITY = [
  "Owner",
  "Admin",
  "President",
  "Vice President",
  "Executive",
  "Committee",
  "Treasurer",
  "Secretary",
  "Registrar",
  "Coordinator",
  "Coach",
  "Manager",
  "Parent",
  "Volunteer",
  "Player",
];

const normalizeRoleValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const getCanonicalRole = (value) => {
  const normalized = normalizeRoleValue(value);
  if (!normalized) return "";

  if (["owner", "club owner", "clubowner"].includes(normalized)) {
    return "Owner";
  }
  if (
    ["admin", "club admin", "clubadmin", "administrator"].includes(
      normalized,
    )
  ) {
    return "Admin";
  }
  if (normalized === "president") return "President";
  if (["vice president", "vicepresident"].includes(normalized)) {
    return "Vice President";
  }
  if (normalized === "executive") return "Executive";
  if (normalized === "committee") return "Committee";
  if (normalized === "treasurer") return "Treasurer";
  if (normalized === "secretary") return "Secretary";
  if (normalized === "registrar") return "Registrar";
  if (normalized === "coordinator") return "Coordinator";
  if (["coach", "club coach", "clubcoach"].includes(normalized)) {
    return "Coach";
  }
  if (["manager", "club manager", "clubmanager"].includes(normalized)) {
    return "Manager";
  }
  if (normalized === "parent") return "Parent";
  if (normalized === "volunteer") return "Volunteer";
  if (normalized === "player" || normalized === "member") return "Player";

  return value;
};

const resolveMembershipRole = (membership, fallbackRole = "") => {
  const roles = Array.isArray(membership?.roles) ? membership.roles : [];
  const canonicalRoles = Array.from(
    new Set(roles.map((role) => getCanonicalRole(role)).filter(Boolean)),
  );

  if (canonicalRoles.length > 0) {
    const prioritized = ROLE_PRIORITY.find((role) => canonicalRoles.includes(role));
    return prioritized || canonicalRoles[0];
  }

  return getCanonicalRole(membership?.role) || getCanonicalRole(fallbackRole) || "";
};

const ClubContext = createContext(null);
const getStoredClubKey = (uid) => `greensports.activeClubId.${uid}`;

export function ClubProvider({ children }) {
  const { user, profile } = useAuth();
  const [activeClubId, setActiveClubId] = useState(null);
  const [activeClub, setActiveClub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolvedClubs, setResolvedClubs] = useState([]);
  const [restoredClubReady, setRestoredClubReady] = useState(false);

  const effectiveMemberships = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];

    if (memberships.length > 0) {
      return memberships;
    }

    const fallbackClubId = String(profile?.clubId || "").trim();
    if (!fallbackClubId) {
      return [];
    }

    const accountType = String(profile?.accountType || "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");

    const profileRole = getCanonicalRole(profile?.role);
    let fallbackRole = "Player";
    if (["clubowner", "owner"].includes(accountType)) fallbackRole = "Owner";
    else if (["clubadmin", "admin"].includes(accountType)) fallbackRole = "Admin";

    return [
      {
        clubId: fallbackClubId,
        clubName: profile?.clubName || "",
        role: profileRole || fallbackRole,
        teamIds: Array.isArray(profile?.teamIds) ? profile.teamIds : [],
        groupIds: Array.isArray(profile?.groupIds) ? profile.groupIds : [],
      },
    ];
  }, [profile]);

  // Resolve club names for memberships (handles old data without clubName)
  useEffect(() => {
    if (!effectiveMemberships.length) {
      setResolvedClubs([]);
      return;
    }
    let cancelled = false;
    const resolve = async () => {
      const resolved = await Promise.all(
        effectiveMemberships.map(async (m) => {
          if (m.clubName) return m;
          try {
            const club = await getClub(m.clubId);
            return { ...m, clubName: club?.name || m.clubId };
          } catch {
            return { ...m, clubName: m.clubId };
          }
        }),
      );
      if (!cancelled) setResolvedClubs(resolved);
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [effectiveMemberships]);

  // Restore previously selected club for this user.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!user?.uid || !profile) {
        if (!cancelled) setRestoredClubReady(true);
        return;
      }

      const memberships = effectiveMemberships;
      if (memberships.length === 0) {
        if (!cancelled) {
          setActiveClubId(null);
          setRestoredClubReady(true);
        }
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(getStoredClubKey(user.uid));
        const exists = stored && memberships.some((m) => m.clubId === stored);
        if (!cancelled) {
          setActiveClubId(exists ? stored : memberships[0].clubId);
        }
      } catch {
        if (!cancelled) {
          setActiveClubId(memberships[0].clubId);
        }
      } finally {
        if (!cancelled) setRestoredClubReady(true);
      }
    };

    setRestoredClubReady(false);
    restore();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, effectiveMemberships, profile]);

  // Keep selection valid as memberships change.
  useEffect(() => {
    if (!restoredClubReady) return;

    const memberships = effectiveMemberships;
    if (memberships.length === 0) {
      if (activeClubId !== null) setActiveClubId(null);
      return;
    }

    const stillValid = memberships.some((m) => m.clubId === activeClubId);
    if (!stillValid) {
      setActiveClubId(memberships[0].clubId);
    }
  }, [effectiveMemberships, activeClubId, restoredClubReady]);

  // Persist selected club per user.
  useEffect(() => {
    const persist = async () => {
      if (!user?.uid) return;
      try {
        const key = getStoredClubKey(user.uid);
        if (activeClubId) {
          await AsyncStorage.setItem(key, activeClubId);
        } else {
          await AsyncStorage.removeItem(key);
        }
      } catch {
        // Non-blocking persistence best effort.
      }
    };
    persist();
  }, [user?.uid, activeClubId]);

  // Subscribe to active club data
  useEffect(() => {
    if (!activeClubId) {
      setActiveClub(null);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToClub(activeClubId, (clubData) => {
      setActiveClub(clubData);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeClubId]);

  const switchClub = useCallback((clubId) => {
    setActiveClubId(clubId);
  }, []);

  // Get current user's role in active club
  const userRole = (() => {
    if (!effectiveMemberships.length || !activeClubId) return "Player";
    const membership = effectiveMemberships.find(
      (m) => m.clubId === activeClubId,
    );
    return resolveMembershipRole(membership, profile?.role) || "Player";
  })();

  // Helper: is this user Owner or Admin of the active club?
  const normalizedUserRole = normalizeRoleValue(userRole);
  const isClubLeader = normalizedUserRole === "owner" || normalizedUserRole === "admin";
  
  // Consistent staff check: matches firestore.rules logic
  const isClubStaff = useMemo(() => {
    const role = normalizedUserRole;
    if (!role) return false;
    return (
      EXECUTIVE_ROLES.has(role) ||
      COMMITTEE_ROLES.has(role) ||
      ["coach", "manager", "volunteer"].includes(role)
    );
  }, [normalizedUserRole]);

  const allClubs =
    resolvedClubs.length > 0 ? resolvedClubs : effectiveMemberships;

  const activeMembership = allClubs.find((m) => m.clubId === activeClubId) || null;

  const userGroupIds = useMemo(() => {
    const ids = new Set();
    const add = (id) => {
      const normalized = String(id || "").trim().toLowerCase();
      if (normalized) ids.add(normalized);
    };

    (Array.isArray(activeMembership?.groupIds) ? activeMembership.groupIds : []).forEach(
      (id) => add(id),
    );
    (Array.isArray(activeMembership?.groups) ? activeMembership.groups : []).forEach((g) =>
      add(g?.groupId),
    );
    (Array.isArray(activeMembership?.teamIds) ? activeMembership.teamIds : []).forEach(
      (teamId) => {
        add(teamId);
        add(`team:${teamId}`);
      },
    );

    const role = normalizeRoleValue(resolveMembershipRole(activeMembership));
    if (EXECUTIVE_ROLES.has(role)) {
      add("executive");
      add("group:executive");
    }
    if (COMMITTEE_ROLES.has(role)) {
      add("committee");
      add("group:committee");
    }

    // Ensure all active members can see open club volunteer duties.
    add("open-volunteers");

    const result = Array.from(ids).sort();
    return result;
  }, [activeMembership]);

  const userGroupIdsKey = useMemo(() => JSON.stringify(userGroupIds), [
    userGroupIds,
  ]);

  return (
    <ClubContext.Provider
      value={{
        activeClubId,
        activeClub,
        userRole,
        isClubLeader,
        isClubStaff,
        loading: loading || !restoredClubReady,
        allClubs,
        activeMembership,
        userGroupIds,
        userGroupIdsKey,
        switchClub,
        hasMultipleClubs: allClubs.length > 1,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export const useClub = () => {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
};
