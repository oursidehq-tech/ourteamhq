import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Building2,
  Trophy,
  Users,
  CalendarDays,
  BarChart2,
  Link2,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import {
  subscribeToLeagueOrganizations,
  subscribeToLeagueCompetitions,
  subscribeToLeagueFixtures,
  createLeagueOrganization,
  createLeagueCompetition,
  createLeagueFixture,
  linkClubTeamToOrganizationTeam,
  updateLeagueFixtureScore,
} from "../../services/leaguePlatformService";
import { subscribeToTeams, updateTeam } from "../../services/teamService";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: BarChart2 },
  { key: "competitions", label: "Competitions", icon: Trophy },
  { key: "teams", label: "Teams", icon: Users },
  { key: "fixtures", label: "Fixtures", icon: CalendarDays },
  { key: "results", label: "Results", icon: BarChart2 },
  { key: "clubs", label: "Clubs / Linked", icon: Link2 },
];

export default function OrganisationScreen({ navigation }) {
  const { user } = useAuth();
  const { activeClubId, isClubLeader } = useClub();
  const canManageOrganisation = !!isClubLeader;
  const [activeTab, setActiveTab] = useState("dashboard");

  const [organizations, setOrganizations] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [orgTeams, setOrgTeams] = useState([]);

  // Create form state
  const [orgName, setOrgName] = useState("");
  const [orgRegion, setOrgRegion] = useState("");
  const [compTitle, setCompTitle] = useState("");
  const [compDivision, setCompDivision] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [fixtureHome, setFixtureHome] = useState("");
  const [fixtureAway, setFixtureAway] = useState("");
  const [fixtureDate, setFixtureDate] = useState("");
  const [fixtureVenue, setFixtureVenue] = useState("");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [selectedHomeOrgTeamId, setSelectedHomeOrgTeamId] = useState("");
  const [selectedAwayOrgTeamId, setSelectedAwayOrgTeamId] = useState("");
  const [fixtureScores, setFixtureScores] = useState({});

  const organizationTeams = useMemo(
    () => orgTeams.filter((team) => team.isOrganizationTeam === true),
    [orgTeams],
  );

  const clubTeams = useMemo(
    () => orgTeams.filter((team) => team.isOrganizationTeam !== true),
    [orgTeams],
  );

  const getLinkedOrganizationTeamId = (team) =>
    String(team?.linkedOrganizationTeamId || team?.linkedOrgTeamId || "").trim();

  useEffect(() => {
    if (!activeClubId) return;
    const u1 = subscribeToLeagueOrganizations(activeClubId, setOrganizations);
    const u2 = subscribeToLeagueCompetitions(activeClubId, setCompetitions);
    const u3 = subscribeToLeagueFixtures(activeClubId, setFixtures);
    const u4 = subscribeToTeams(activeClubId, setOrgTeams);
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); };
  }, [activeClubId]);

  const onCreateOrg = async () => {
    if (!activeClubId || !canManageOrganisation) return;
    if (!orgName.trim()) { Alert.alert("Required", "Organisation name is required."); return; }
    try {
      await createLeagueOrganization(activeClubId, {
        name: orgName.trim(), region: orgRegion.trim(), createdBy: user?.uid || "",
      });
      setOrgName(""); setOrgRegion("");
      Alert.alert("Created", "Organisation created.");
    } catch { Alert.alert("Error", "Could not create organisation."); }
  };

  const onCreateCompetition = async () => {
    if (!activeClubId || !canManageOrganisation) return;
    if (!compTitle.trim()) { Alert.alert("Required", "Title is required."); return; }
    try {
      await createLeagueCompetition(activeClubId, {
        organizationId: selectedOrgId,
        organizationName: organizations.find(o => o.id === selectedOrgId)?.name || "",
        title: compTitle.trim(), division: compDivision.trim(),
        createdBy: user?.uid || "",
      });
      setCompTitle(""); setCompDivision("");
      Alert.alert("Created", "Competition created.");
    } catch { Alert.alert("Error", "Could not create competition."); }
  };

  const onCreateFixture = async () => {
    if (!activeClubId || !canManageOrganisation) return;
    if (!fixtureHome.trim() || !fixtureAway.trim() || !fixtureDate.trim()) {
      Alert.alert("Required", "Home team, away team and date are required."); return;
    }
    if (
      selectedHomeOrgTeamId &&
      selectedAwayOrgTeamId &&
      selectedHomeOrgTeamId === selectedAwayOrgTeamId
    ) {
      Alert.alert("Invalid Teams", "Home and away teams must be different.");
      return;
    }
    try {
      await createLeagueFixture(activeClubId, {
        competitionId: selectedCompId,
        competitionTitle: competitions.find(c => c.id === selectedCompId)?.title || "",
        homeTeam: fixtureHome.trim(), awayTeam: fixtureAway.trim(),
        homeOrganizationTeamId: selectedHomeOrgTeamId,
        awayOrganizationTeamId: selectedAwayOrgTeamId,
        fixtureDate: fixtureDate.trim(), venue: fixtureVenue.trim(),
        createdBy: user?.uid || "",
      });
      setFixtureHome(""); setFixtureAway(""); setFixtureDate(""); setFixtureVenue("");
      setSelectedHomeOrgTeamId("");
      setSelectedAwayOrgTeamId("");
    } catch { Alert.alert("Error", "Could not create fixture."); }
  };

  const onSaveScore = async (fixture) => {
    if (!canManageOrganisation) return;
    const d = fixtureScores[fixture.id] || {};
    try {
      await updateLeagueFixtureScore(activeClubId, fixture.id, {
        homeScore: d.home, awayScore: d.away,
        status: "completed", updatedBy: user?.uid || "",
      });
    } catch { Alert.alert("Error", "Could not save score."); }
  };

  const completedFixtures = fixtures.filter(f => f.status === "completed");
  const upcomingFixtures = fixtures.filter(f => f.status !== "completed");

  const onSetOrganizationTeam = async (teamId, enabled) => {
    if (!activeClubId || !canManageOrganisation) return;
    try {
      await updateTeam(activeClubId, teamId, {
        isOrganizationTeam: !!enabled,
      });
    } catch {
      Alert.alert("Error", "Could not update team scope.");
    }
  };

  const onLinkClubTeam = async (clubTeamId, organizationTeamId) => {
    if (!activeClubId || !canManageOrganisation) return;
    try {
      await linkClubTeamToOrganizationTeam(activeClubId, {
        clubTeamId,
        organizationTeamId,
        linkedBy: user?.uid || "",
      });
    } catch {
      Alert.alert("Error", "Could not link club team.");
    }
  };

  const onUnlinkClubTeam = async (clubTeamId) => {
    if (!activeClubId || !canManageOrganisation) return;
    try {
      await linkClubTeamToOrganizationTeam(activeClubId, {
        clubTeamId,
        organizationTeamId: "",
        linkedBy: user?.uid || "",
      });
    } catch {
      Alert.alert("Error", "Could not unlink club team.");
    }
  };

  const renderDashboard = () => (
    <>
      <Card style={styles.panelCard}>
        <Text variant="h3" style={{ marginBottom: 8 }}>Organisation Overview</Text>
        <Text variant="small" color={theme.colors.textSecondary}>
          This is the source of truth for all fixtures. Clubs link their teams and fixtures
          flow down automatically — clubs cannot override fixtures set here.
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text variant="h2">{organizations.length}</Text>
            <Text variant="small">Orgs</Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="h2">{competitions.length}</Text>
            <Text variant="small">Competitions</Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="h2">{fixtures.length}</Text>
            <Text variant="small">Fixtures</Text>
          </View>
          <View style={styles.statBox}>
            <Text variant="h2">{organizationTeams.length}</Text>
            <Text variant="small">Org Teams</Text>
          </View>
        </View>
      </Card>
      <Card style={styles.panelCard}>
        <Text variant="h4">Recent Fixtures</Text>
        {upcomingFixtures.slice(0, 3).map(f => (
          <View key={f.id} style={styles.itemRow}>
            <Text variant="body" weight="600">{f.homeTeam} vs {f.awayTeam}</Text>
            <Text variant="small" color={theme.colors.textSecondary}>{f.fixtureDate} | {f.venue || "TBD"}</Text>
          </View>
        ))}
        {upcomingFixtures.length === 0 && (
          <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>No upcoming fixtures.</Text>
        )}
      </Card>
    </>
  );

  const renderCompetitions = () => (
    <>
      {canManageOrganisation && (
        <Card style={styles.panelCard}>
          <Text variant="h4" style={{ marginBottom: 8 }}>Create Organisation</Text>
          <TextInput style={styles.input} placeholder="Organisation name" value={orgName} onChangeText={setOrgName} />
          <TextInput style={styles.input} placeholder="Region" value={orgRegion} onChangeText={setOrgRegion} />
          <Button title="Create Organisation" size="small" onPress={onCreateOrg} />
          <View style={{ height: 16 }} />
          <Text variant="h4" style={{ marginBottom: 8 }}>Create Competition</Text>
          <TextInput style={styles.input} placeholder="Competition title" value={compTitle} onChangeText={setCompTitle} />
          <TextInput style={styles.input} placeholder="Division" value={compDivision} onChangeText={setCompDivision} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {organizations.map(org => (
              <TouchableOpacity
                key={org.id}
                style={[styles.chip, selectedOrgId === org.id && styles.chipActive]}
                onPress={() => setSelectedOrgId(org.id)}
              >
                <Text variant="small" weight="700" color={selectedOrgId === org.id ? theme.colors.white : theme.colors.text}>{org.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button title="Create Competition" size="small" onPress={onCreateCompetition} />
        </Card>
      )}
      {competitions.map(comp => (
        <Card key={comp.id} style={styles.panelCard}>
          <Text variant="h4">{comp.title}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>{comp.division || "General Division"} | {comp.organizationName}</Text>
        </Card>
      ))}
    </>
  );

  const renderTeams = () => (
    <>
      {canManageOrganisation && (
        <Card style={styles.panelCard}>
          <Text variant="h4" style={{ marginBottom: 8 }}>Organisation Teams</Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            Clubs link their club team to an organisation team. Once linked, all fixtures flow to the club team automatically.
          </Text>
          <Button title="Create Team" size="small" style={{ marginTop: 12 }}
            onPress={() => navigation.navigate("CreateItem", { title: "Create Team", type: "Team" })} />
        </Card>
      )}
      {organizationTeams.map(team => (
        <Card key={team.id} style={styles.panelCard}>
          <Text variant="h4">{team.name}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>{team.ageGroup || ""}</Text>
          {canManageOrganisation && (
            <TouchableOpacity onPress={() => onSetOrganizationTeam(team.id, false)} style={styles.linkAction}>
              <Text variant="small" color={theme.colors.error} weight="700">Remove from Organisation Teams</Text>
            </TouchableOpacity>
          )}
        </Card>
      ))}

      <Card style={styles.panelCard}>
        <Text variant="h4" style={{ marginBottom: 8 }}>Club Teams</Text>
        {clubTeams.map(team => (
          <View key={team.id} style={styles.itemRow}>
            <Text variant="body" weight="600">{team.name}</Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              Linked org team: {organizationTeams.find((orgTeam) => orgTeam.id === getLinkedOrganizationTeamId(team))?.name || "Not linked"}
            </Text>
            {canManageOrganisation && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {organizationTeams.map(orgTeam => (
                    <TouchableOpacity
                      key={`${team.id}-${orgTeam.id}`}
                      style={styles.chip}
                      onPress={() => onLinkClubTeam(team.id, orgTeam.id)}
                    >
                      <Text variant="small" weight="700">Link: {orgTeam.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {!!getLinkedOrganizationTeamId(team) && (
                  <TouchableOpacity onPress={() => onUnlinkClubTeam(team.id)} style={styles.linkAction}>
                    <Text variant="small" color={theme.colors.error} weight="700">Unlink Team</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onSetOrganizationTeam(team.id, true)} style={styles.linkAction}>
                  <Text variant="small" color={theme.colors.primary} weight="700">Promote as Organisation Team</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
      </Card>
    </>
  );

  const renderFixtures = () => (
    <>
      {canManageOrganisation && (
        <Card style={styles.panelCard}>
          <Text variant="h4" style={{ marginBottom: 8 }}>Add Fixture</Text>
          <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 8 }}>
            Select organisation teams to auto-flow fixtures to linked club teams.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {organizationTeams.map(team => (
              <TouchableOpacity
                key={`home-${team.id}`}
                style={[styles.chip, selectedHomeOrgTeamId === team.id && styles.chipActive]}
                onPress={() => {
                  setSelectedHomeOrgTeamId(team.id);
                  setFixtureHome(team.name || "");
                }}
              >
                <Text variant="small" weight="700" color={selectedHomeOrgTeamId === team.id ? theme.colors.white : theme.colors.text}>Home: {team.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {organizationTeams.map(team => (
              <TouchableOpacity
                key={`away-${team.id}`}
                style={[styles.chip, selectedAwayOrgTeamId === team.id && styles.chipActive]}
                onPress={() => {
                  setSelectedAwayOrgTeamId(team.id);
                  setFixtureAway(team.name || "");
                }}
              >
                <Text variant="small" weight="700" color={selectedAwayOrgTeamId === team.id ? theme.colors.white : theme.colors.text}>Away: {team.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={styles.input} placeholder="Home team" value={fixtureHome} onChangeText={setFixtureHome} />
          <TextInput style={styles.input} placeholder="Away team" value={fixtureAway} onChangeText={setFixtureAway} />
          <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={fixtureDate} onChangeText={setFixtureDate} />
          <TextInput style={styles.input} placeholder="Venue" value={fixtureVenue} onChangeText={setFixtureVenue} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {competitions.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedCompId === c.id && styles.chipActive]}
                onPress={() => setSelectedCompId(c.id)}
              >
                <Text variant="small" weight="700" color={selectedCompId === c.id ? theme.colors.white : theme.colors.text}>{c.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button title="Add Fixture" size="small" onPress={onCreateFixture} />
        </Card>
      )}
      {upcomingFixtures.map(f => (
        <Card key={f.id} style={styles.panelCard}>
          <Text variant="body" weight="600">{f.homeTeam} vs {f.awayTeam}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>{f.fixtureDate} | {f.venue || "TBD"}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>{f.competitionTitle}</Text>
          {canManageOrganisation && (
            <View style={styles.scoreRow}>
              <TextInput
                style={styles.scoreInput}
                keyboardType="number-pad"
                placeholder="H"
                value={`${fixtureScores[f.id]?.home ?? ""}`}
                onChangeText={v => setFixtureScores(p => ({ ...p, [f.id]: { ...(p[f.id] || {}), home: v } }))}
              />
              <Text variant="body" weight="700" style={{ marginHorizontal: 6 }}>-</Text>
              <TextInput
                style={styles.scoreInput}
                keyboardType="number-pad"
                placeholder="A"
                value={`${fixtureScores[f.id]?.away ?? ""}`}
                onChangeText={v => setFixtureScores(p => ({ ...p, [f.id]: { ...(p[f.id] || {}), away: v } }))}
              />
              <TouchableOpacity onPress={() => onSaveScore(f)} style={styles.saveScoreBtn}>
                <Text variant="small" color={theme.colors.primary} weight="700">Save Score</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      ))}
      {upcomingFixtures.length === 0 && (
        <Card style={styles.panelCard}>
          <Text variant="small" color={theme.colors.textSecondary}>No upcoming fixtures.</Text>
        </Card>
      )}
    </>
  );

  const renderResults = () => (
    <>
      {completedFixtures.length === 0 ? (
        <Card style={styles.panelCard}>
          <Text variant="small" color={theme.colors.textSecondary}>No results yet.</Text>
        </Card>
      ) : completedFixtures.map(f => (
        <Card key={f.id} style={styles.panelCard}>
          <Text variant="body" weight="600">
            {f.homeTeam} {f.homeScore ?? "-"} : {f.awayScore ?? "-"} {f.awayTeam}
          </Text>
          <Text variant="small" color={theme.colors.textSecondary}>{f.fixtureDate} | {f.competitionTitle}</Text>
        </Card>
      ))}
    </>
  );

  const renderClubs = () => (
    <Card style={styles.panelCard}>
      <Text variant="h4" style={{ marginBottom: 8 }}>Clubs / Linked Teams</Text>
      <Text variant="small" color={theme.colors.textSecondary}>
        Clubs that link their team to an organisation team will automatically receive all fixtures and updates set here.
        Clubs cannot override organisation-level fixtures.
      </Text>
      {clubTeams.filter(t => !!getLinkedOrganizationTeamId(t)).map(t => (
        <View key={t.id} style={styles.itemRow}>
          <Text variant="body" weight="600">{t.name}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            Linked org team: {organizationTeams.find((orgTeam) => orgTeam.id === getLinkedOrganizationTeamId(t))?.name || getLinkedOrganizationTeamId(t)}
          </Text>
        </View>
      ))}
    </Card>
  );

  const getTabContent = () => {
    switch (activeTab) {
      case "dashboard": return renderDashboard();
      case "competitions": return renderCompetitions();
      case "teams": return renderTeams();
      case "fixtures": return renderFixtures();
      case "results": return renderResults();
      case "clubs": return renderClubs();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={theme.colors.text} size={28} />
        </TouchableOpacity>
        <Building2 color={theme.colors.primary} size={22} style={{ marginRight: 8 }} />
        <Text variant="h2">Organisation</Text>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={13} color={active ? theme.colors.white : theme.colors.textSecondary} />
              <Text variant="small" weight="700" color={active ? theme.colors.white : theme.colors.textSecondary} style={{ marginLeft: 4 }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {getTabContent()}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { marginRight: theme.spacing.sm },
  tabBar: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tabBarContent: { paddingHorizontal: theme.spacing.md, paddingVertical: 10, gap: 8, flexDirection: "row" },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  content: { padding: theme.spacing.md },
  panelCard: { marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  statBox: { alignItems: "center", flex: 1 },
  itemRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  scoreRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  scoreInput: {
    width: 44, height: 36, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, textAlign: "center", fontSize: 14, color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  saveScoreBtn: { marginLeft: 10, paddingVertical: 4, paddingHorizontal: 8 },
  linkedBadge: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  linkAction: { marginTop: 8, alignSelf: "flex-start" },
});
