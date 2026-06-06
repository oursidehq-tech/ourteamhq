import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Megaphone,
  Radio,
} from "lucide-react-native";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Typography";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import { theme } from "../../theme/theme";
import {
  createFacilityBooking,
  createLeagueAnnouncement,
  createLeagueCompetition,
  createLeagueFixture,
  createLeagueOrganization,
  createSponsor,
  syncLeagueFixtureScoresFromProvider,
  subscribeToFacilityBookings,
  subscribeToLeagueAnnouncements,
  subscribeToLeagueCompetitions,
  subscribeToLeagueFixtures,
  subscribeToLeagueOrganizations,
  subscribeToLiveScoreIntegrationConfig,
  subscribeToSponsors,
  updateFacilityBookingStatus,
  updateLeagueFixtureScore,
  upsertLiveScoreIntegrationConfig,
} from "../../services/leaguePlatformService";
import {
  createSponsorInvite,
} from "../../services/clubService";

const TABS = ["Organisation", "Live Score", "Sponsors", "Facilities"];

export default function LeaguePlatformScreen({ route }) {
  const { user, profile } = useAuth();
  const { activeClubId, isClubLeader, userRole } = useClub();
  const isStaff = ["Owner", "Admin", "Coach", "Manager"].includes(userRole);
  const canManageOrganisationLayer = !!isClubLeader;

  const [tabIndex, setTabIndex] = useState(route?.params?.initialTab || 0);

  const [organizations, setOrganizations] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [integrationConfig, setIntegrationConfig] = useState(null);

  const [orgName, setOrgName] = useState("");
  const [orgRegion, setOrgRegion] = useState("");
  const [orgSeason, setOrgSeason] = useState("");

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [compTitle, setCompTitle] = useState("");
  const [compDivision, setCompDivision] = useState("");
  const [compSeason, setCompSeason] = useState("");

  const [selectedCompId, setSelectedCompId] = useState("");
  const [fixtureHome, setFixtureHome] = useState("");
  const [fixtureAway, setFixtureAway] = useState("");
  const [fixtureDate, setFixtureDate] = useState("");
  const [fixtureVenue, setFixtureVenue] = useState("");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  const [provider, setProvider] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [tokenHint, setTokenHint] = useState("");
  const [integrationNotes, setIntegrationNotes] = useState("");
  const [approvedByLeague, setApprovedByLeague] = useState(false);

  const [sponsorName, setSponsorName] = useState("");
  const [sponsorTier, setSponsorTier] = useState("Community");
  const [sponsorAmount, setSponsorAmount] = useState("");
  const [sponsorContactName, setSponsorContactName] = useState("");
  const [sponsorContactEmail, setSponsorContactEmail] = useState("");
  const [sponsorWebsite, setSponsorWebsite] = useState("");

  const [facilityName, setFacilityName] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");

  const [fixtureScores, setFixtureScores] = useState({});
  const [syncingLiveScores, setSyncingLiveScores] = useState(false);

  // Sponsor invite state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteTargetSponsor, setInviteTargetSponsor] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const formatSyncTime = (value) => {
    if (!value) return "Never";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    return String(value);
  };

  useEffect(() => {
    if (!activeClubId) return;

    const unsubOrg = subscribeToLeagueOrganizations(
      activeClubId,
      setOrganizations,
    );
    const unsubComps = subscribeToLeagueCompetitions(
      activeClubId,
      setCompetitions,
    );
    const unsubFix = subscribeToLeagueFixtures(activeClubId, setFixtures);
    const unsubAnn = subscribeToLeagueAnnouncements(
      activeClubId,
      setAnnouncements,
    );
    const unsubSponsors = subscribeToSponsors(activeClubId, setSponsors);
    const unsubBookings = subscribeToFacilityBookings(
      activeClubId,
      setBookings,
    );
    const unsubIntegration = subscribeToLiveScoreIntegrationConfig(
      activeClubId,
      (config) => {
        setIntegrationConfig(config);
        if (config) {
          setProvider(config.provider || "");
          setApiBaseUrl(config.apiBaseUrl || "");
          setTokenHint(config.tokenHint || "");
          setIntegrationNotes(config.notes || "");
          setApprovedByLeague(!!config.approvedByLeague);
        }
      },
    );

    return () => {
      unsubOrg?.();
      unsubComps?.();
      unsubFix?.();
      unsubAnn?.();
      unsubSponsors?.();
      unsubBookings?.();
      unsubIntegration?.();
    };
  }, [activeClubId]);

  const organizationById = useMemo(() => {
    const map = new Map();
    (organizations || []).forEach((row) => map.set(row.id, row));
    return map;
  }, [organizations]);

  const competitionById = useMemo(() => {
    const map = new Map();
    (competitions || []).forEach((row) => map.set(row.id, row));
    return map;
  }, [competitions]);

  const onCreateOrganization = async () => {
    if (!activeClubId || !canManageOrganisationLayer) return;
    if (!orgName.trim()) {
      Alert.alert("Missing name", "Add an organization name.");
      return;
    }
    try {
      await createLeagueOrganization(activeClubId, {
        name: orgName,
        region: orgRegion,
        season: orgSeason,
        createdBy: user?.uid || "",
      });
      setOrgName("");
      setOrgRegion("");
      setOrgSeason("");
    } catch {
      Alert.alert("Error", "Could not create organization.");
    }
  };

  const onCreateCompetition = async () => {
    if (!activeClubId || !canManageOrganisationLayer) return;
    if (!compTitle.trim()) {
      Alert.alert("Missing title", "Add a competition title.");
      return;
    }

    const selectedOrg = organizationById.get(selectedOrgId);

    try {
      await createLeagueCompetition(activeClubId, {
        organizationId: selectedOrgId,
        organizationName: selectedOrg?.name || "",
        title: compTitle,
        division: compDivision,
        season: compSeason,
        createdBy: user?.uid || "",
      });
      setCompTitle("");
      setCompDivision("");
      setCompSeason("");
    } catch {
      Alert.alert("Error", "Could not create competition.");
    }
  };

  const onCreateFixture = async () => {
    if (!activeClubId || !canManageOrganisationLayer) return;
    if (!fixtureHome.trim() || !fixtureAway.trim() || !fixtureDate.trim()) {
      Alert.alert("Missing fields", "Home, Away and Date are required.");
      return;
    }

    const selectedComp = competitionById.get(selectedCompId);

    try {
      await createLeagueFixture(activeClubId, {
        competitionId: selectedCompId,
        competitionTitle: selectedComp?.title || "",
        homeTeam: fixtureHome,
        awayTeam: fixtureAway,
        fixtureDate,
        venue: fixtureVenue,
        createdBy: user?.uid || "",
      });
      setFixtureHome("");
      setFixtureAway("");
      setFixtureDate("");
      setFixtureVenue("");
    } catch {
      Alert.alert("Error", "Could not create fixture.");
    }
  };

  const onCreateAnnouncement = async () => {
    if (!activeClubId || !canManageOrganisationLayer) return;
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      Alert.alert("Missing fields", "Title and message are required.");
      return;
    }

    const selectedOrg = organizationById.get(selectedOrgId);

    try {
      await createLeagueAnnouncement(activeClubId, {
        organizationId: selectedOrgId,
        organizationName: selectedOrg?.name || "",
        title: announcementTitle,
        message: announcementMessage,
        audience: "all",
        createdBy: user?.uid || "",
      });
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    } catch {
      Alert.alert("Error", "Could not create announcement.");
    }
  };

  const onSaveIntegration = async () => {
    if (!activeClubId || !isClubLeader) return;
    if (!provider.trim()) {
      Alert.alert("Missing provider", "Add competition provider name.");
      return;
    }

    try {
      await upsertLiveScoreIntegrationConfig(activeClubId, {
        provider,
        apiBaseUrl,
        feedType: "pull",
        authMode: "api-key",
        tokenHint,
        approvedByLeague,
        notes: integrationNotes,
        updatedBy: user?.uid || "",
      });
      Alert.alert("Saved", "Live score integration config saved.");
    } catch {
      Alert.alert("Error", "Could not save integration config.");
    }
  };

  const onSaveSponsor = async () => {
    if (!activeClubId || !isStaff) return;
    if (!sponsorName.trim()) {
      Alert.alert("Missing name", "Add sponsor name.");
      return;
    }

    try {
      await createSponsor(activeClubId, {
        name: sponsorName,
        tier: sponsorTier,
        amount: sponsorAmount,
        contactName: sponsorContactName,
        contactEmail: sponsorContactEmail,
        websiteUrl: sponsorWebsite,
        status: "active",
        createdBy: user?.uid || "",
      });
      setSponsorName("");
      setSponsorAmount("");
      setSponsorContactName("");
      setSponsorContactEmail("");
      setSponsorWebsite("");
    } catch {
      Alert.alert("Error", "Could not create sponsor.");
    }
  };

  const onInviteSponsor = (sponsor) => {
    setInviteTargetSponsor(sponsor);
    setInviteEmail(sponsor?.contactEmail || "");
    setInviteModalOpen(true);
  };

  const onSendSponsorInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert("Required", "Enter the sponsor's email address.");
      return;
    }
    setSendingInvite(true);
    try {
      await createSponsorInvite(activeClubId, {
        sponsorEmail: inviteEmail,
        createdBy: user?.uid || "",
        clubName: profile?.clubName || "",
      });
      Alert.alert(
        "Invite Sent",
        `An invite has been sent to ${inviteEmail}. Once accepted, they can manage their sponsor page.`,
      );
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteTargetSponsor(null);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not send invite.");
    } finally {
      setSendingInvite(false);
    }
  };

  const onCreateBooking = async () => {
    if (!activeClubId) return;
    if (!facilityName.trim() || !bookingDate.trim()) {
      Alert.alert("Missing fields", "Facility name and date are required.");
      return;
    }

    try {
      await createFacilityBooking(activeClubId, {
        facilityName,
        bookingDate,
        startTime: bookingStart,
        endTime: bookingEnd,
        purpose: bookingPurpose,
        requesterId: user?.uid || "",
        requesterName: profile?.displayName || profile?.email || "",
        contactPhone: bookingPhone,
      });
      setFacilityName("");
      setBookingDate("");
      setBookingStart("");
      setBookingEnd("");
      setBookingPurpose("");
      setBookingPhone("");
      Alert.alert("Request sent", "Facility booking request created.");
    } catch {
      Alert.alert("Error", "Could not create booking.");
    }
  };

  const onUpdateBookingStatus = async (bookingId, status) => {
    if (!activeClubId || !isStaff) return;

    try {
      await updateFacilityBookingStatus(activeClubId, bookingId, {
        status,
        reviewedBy: user?.uid || "",
        reviewNote: "",
      });
    } catch {
      Alert.alert("Error", "Could not update booking status.");
    }
  };

  const onSaveFixtureScore = async (fixture) => {
    if (!activeClubId || !canManageOrganisationLayer) return;
    const draft = fixtureScores[fixture.id] || {};

    try {
      await updateLeagueFixtureScore(activeClubId, fixture.id, {
        homeScore: draft.home,
        awayScore: draft.away,
        status: fixture.status === "scheduled" ? "live" : fixture.status,
        updatedBy: user?.uid || "",
      });
    } catch {
      Alert.alert("Error", "Could not update fixture score.");
    }
  };

  const onSyncScoresFromProvider = async () => {
    if (!activeClubId || !isClubLeader || syncingLiveScores) return;

    setSyncingLiveScores(true);
    try {
      const result = await syncLeagueFixtureScoresFromProvider(activeClubId, {
        updatedBy: user?.uid || "",
      });

      Alert.alert(
        "Live Scores Synced",
        `Updated ${result.updatedCount} fixtures. Skipped ${result.skippedCount} rows from ${result.payloadCount} provider rows.`,
      );
    } catch (error) {
      Alert.alert(
        "Sync Failed",
        error?.message || "Could not sync live scores right now.",
      );
    } finally {
      setSyncingLiveScores(false);
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab, index) => {
          const active = index === tabIndex;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setTabIndex(index)}
            >
              <Text
                variant="small"
                weight="700"
                color={active ? theme.colors.white : theme.colors.textSecondary}
                allowFontScaling={false}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderOrganisationTab = () => (
    <>
      {canManageOrganisationLayer ? (
        <Card style={styles.panelCard}>
          <View style={styles.iconTitleRow}>
            <Building2 color={theme.colors.primary} size={18} />
            <Text variant="h4" style={{ marginLeft: 8 }}>
              Governing Body Setup
            </Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Organisation name"
            value={orgName}
            onChangeText={setOrgName}
          />
          <TextInput
            style={styles.input}
            placeholder="Region"
            value={orgRegion}
            onChangeText={setOrgRegion}
          />
          <TextInput
            style={styles.input}
            placeholder="Season"
            value={orgSeason}
            onChangeText={setOrgSeason}
          />
          <Button
            title="Create Organisation"
            size="small"
            onPress={onCreateOrganization}
          />
        </Card>
      ) : null}

      <Card style={styles.panelCard}>
        <Text variant="h4">Competitions</Text>
        {canManageOrganisationLayer ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Competition title"
              value={compTitle}
              onChangeText={setCompTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Division"
              value={compDivision}
              onChangeText={setCompDivision}
            />
            <TextInput
              style={styles.input}
              placeholder="Season"
              value={compSeason}
              onChangeText={setCompSeason}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalChips}
            >
              {(organizations || []).map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.selectChip,
                    selectedOrgId === org.id && styles.selectChipActive,
                  ]}
                  onPress={() => setSelectedOrgId(org.id)}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={
                      selectedOrgId === org.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {org.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Create Competition"
              size="small"
              onPress={onCreateCompetition}
            />
          </>
        ) : null}

        {(competitions || []).map((row) => (
          <View key={row.id} style={styles.itemRow}>
            <Text variant="body" weight="600">
              {row.title}
            </Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              {row.division || "General"} | {row.season || "No season"}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.panelCard}>
        <Text variant="h4">Fixtures</Text>
        {canManageOrganisationLayer ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Home team"
              value={fixtureHome}
              onChangeText={setFixtureHome}
            />
            <TextInput
              style={styles.input}
              placeholder="Away team"
              value={fixtureAway}
              onChangeText={setFixtureAway}
            />
            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD HH:mm)"
              value={fixtureDate}
              onChangeText={setFixtureDate}
            />
            <TextInput
              style={styles.input}
              placeholder="Venue"
              value={fixtureVenue}
              onChangeText={setFixtureVenue}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalChips}
            >
              {(competitions || []).map((competition) => (
                <TouchableOpacity
                  key={competition.id}
                  style={[
                    styles.selectChip,
                    selectedCompId === competition.id &&
                      styles.selectChipActive,
                  ]}
                  onPress={() => setSelectedCompId(competition.id)}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={
                      selectedCompId === competition.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {competition.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title="Add Fixture"
              size="small"
              onPress={onCreateFixture}
            />
          </>
        ) : null}

        {(fixtures || []).map((fixture) => {
          const draft = fixtureScores[fixture.id] || {};
          const homeValue = draft.home ?? fixture.homeScore ?? "";
          const awayValue = draft.away ?? fixture.awayScore ?? "";

          return (
            <View key={fixture.id} style={styles.itemRow}>
              <Text variant="body" weight="600">
                {fixture.homeTeam} vs {fixture.awayTeam}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {fixture.fixtureDate || "TBD"} | {fixture.venue || "Venue TBD"}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {fixture.competitionTitle || "Competition"} | {fixture.status}
              </Text>

              {canManageOrganisationLayer ? (
                <View style={styles.scoreEditorRow}>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={`${homeValue}`}
                    onChangeText={(value) =>
                      setFixtureScores((prev) => ({
                        ...prev,
                        [fixture.id]: {
                          ...(prev[fixture.id] || {}),
                          home: value,
                        },
                      }))
                    }
                  />
                  <Text
                    variant="body"
                    weight="700"
                    style={{ marginHorizontal: 6 }}
                  >
                    -
                  </Text>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={`${awayValue}`}
                    onChangeText={(value) =>
                      setFixtureScores((prev) => ({
                        ...prev,
                        [fixture.id]: {
                          ...(prev[fixture.id] || {}),
                          away: value,
                        },
                      }))
                    }
                  />
                  <TouchableOpacity
                    onPress={() => onSaveFixtureScore(fixture)}
                    style={styles.inlineAction}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="700"
                    >
                      Save Score
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card style={styles.panelCard}>
        <View style={styles.iconTitleRow}>
          <Megaphone color={theme.colors.primary} size={18} />
          <Text variant="h4" style={{ marginLeft: 8 }}>
            League Announcements
          </Text>
        </View>

        {canManageOrganisationLayer ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Announcement title"
              value={announcementTitle}
              onChangeText={setAnnouncementTitle}
            />
            <TextInput
              style={[styles.input, styles.multiInput]}
              multiline
              placeholder="Announcement message"
              value={announcementMessage}
              onChangeText={setAnnouncementMessage}
            />
            <Button
              title="Publish Announcement"
              size="small"
              onPress={onCreateAnnouncement}
            />
          </>
        ) : null}

        {(announcements || []).map((row) => (
          <View key={row.id} style={styles.itemRow}>
            <Text variant="body" weight="600">
              {row.title}
            </Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              {row.message}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );

  const renderLiveScoreTab = () => (
    <>
      <Card style={styles.panelCard}>
        <View style={styles.iconTitleRow}>
          <Radio color={theme.colors.primary} size={18} />
          <Text variant="h4" style={{ marginLeft: 8 }}>
            Live Score Integration
          </Text>
        </View>
        <Text variant="small" style={{ marginTop: 6 }}>
          External competition APIs usually require league approval and
          credentials.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Provider (e.g. PlayHQ, SportsTG, custom API)"
          value={provider}
          onChangeText={setProvider}
          editable={isClubLeader}
        />
        <TextInput
          style={styles.input}
          placeholder="API base URL"
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          editable={isClubLeader}
        />
        <TextInput
          style={styles.input}
          placeholder="Credential hint (never store real secrets in app)"
          value={tokenHint}
          onChangeText={setTokenHint}
          editable={isClubLeader}
        />
        <TextInput
          style={[styles.input, styles.multiInput]}
          multiline
          placeholder="Approval notes / integration details"
          value={integrationNotes}
          onChangeText={setIntegrationNotes}
          editable={isClubLeader}
        />

        <TouchableOpacity
          style={styles.booleanRow}
          disabled={!isClubLeader}
          onPress={() => setApprovedByLeague((prev) => !prev)}
        >
          <View
            style={[
              styles.booleanDot,
              {
                backgroundColor: approvedByLeague
                  ? theme.colors.primary
                  : "#D1D5DB",
              },
            ]}
          />
          <Text variant="body" weight="600">
            League approval received
          </Text>
        </TouchableOpacity>

        {isClubLeader ? (
          <>
            <Button
              title="Save Integration Setup"
              size="small"
              onPress={onSaveIntegration}
            />
            <View style={{ height: 8 }} />
            <Button
              title={syncingLiveScores ? "Syncing..." : "Sync Scores Now"}
              size="small"
              variant="outline"
              onPress={onSyncScoresFromProvider}
              disabled={syncingLiveScores}
            />
          </>
        ) : null}
      </Card>

      <Card style={styles.panelCard}>
        <Text variant="h4">Status</Text>
        <Text variant="small" style={{ marginTop: 8 }}>
          Provider: {integrationConfig?.provider || "Not configured"}
        </Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Approval:{" "}
          {integrationConfig?.approvedByLeague ? "Approved" : "Pending"}
        </Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Feed mode: {integrationConfig?.feedType || "pull"}
        </Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Last sync: {formatSyncTime(integrationConfig?.lastSyncAt)}
        </Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Last sync status: {integrationConfig?.lastSyncStatus || "Not run"}
        </Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Updated fixtures: {integrationConfig?.lastSyncUpdatedFixtures || 0}
        </Text>
        {integrationConfig?.lastSyncError ? (
          <Text variant="small" style={{ marginTop: 4 }}>
            Last error: {integrationConfig.lastSyncError}
          </Text>
        ) : null}
      </Card>
    </>
  );

  const renderSponsorsTab = () => (
    <>
      {isStaff ? (
        <Card style={styles.panelCard}>
          <View style={styles.iconTitleRow}>
            <CircleDollarSign color={theme.colors.primary} size={18} />
            <Text variant="h4" style={{ marginLeft: 8 }}>
              Sponsor Hub
            </Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Sponsor name"
            value={sponsorName}
            onChangeText={setSponsorName}
          />
          <TextInput
            style={styles.input}
            placeholder="Tier (Community, Silver, Gold, Major)"
            value={sponsorTier}
            onChangeText={setSponsorTier}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount"
            value={sponsorAmount}
            keyboardType="decimal-pad"
            onChangeText={setSponsorAmount}
          />
          <TextInput
            style={styles.input}
            placeholder="Contact name"
            value={sponsorContactName}
            onChangeText={setSponsorContactName}
          />
          <TextInput
            style={styles.input}
            placeholder="Contact email"
            value={sponsorContactEmail}
            onChangeText={setSponsorContactEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Website URL"
            value={sponsorWebsite}
            onChangeText={setSponsorWebsite}
          />
          <Button title="Add Sponsor" size="small" onPress={onSaveSponsor} />
        </Card>
      ) : null}

      <Card style={styles.panelCard}>
        <Text variant="h4">Active Sponsors</Text>
        {(sponsors || []).length === 0 ? (
          <Text variant="small" style={{ marginTop: 8 }}>
            No sponsors added yet.
          </Text>
        ) : (
          (sponsors || []).map((row) => (
            <View key={row.id} style={styles.itemRow}>
              <Text variant="body" weight="600">
                {row.name}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {row.tier || "Community"}
                {row.amount ? ` | $${row.amount}` : ""}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {row.contactName || ""}
                {row.contactEmail ? ` | ${row.contactEmail}` : ""}
              </Text>
              {isStaff && (
                <TouchableOpacity
                  onPress={() => onInviteSponsor(row)}
                  style={styles.inviteBtn}
                >
                  <Text variant="small" color={theme.colors.primary} weight="700">
                    Invite Sponsor
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </Card>
    </>
  );

  const renderFacilitiesTab = () => (
    <>
      <Card style={styles.panelCard}>
        <View style={styles.iconTitleRow}>
          <CalendarDays color={theme.colors.primary} size={18} />
          <Text variant="h4" style={{ marginLeft: 8 }}>
            Clubhouse Hire Request
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Facility name"
          value={facilityName}
          onChangeText={setFacilityName}
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD)"
          value={bookingDate}
          onChangeText={setBookingDate}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Start (HH:mm)"
            value={bookingStart}
            onChangeText={setBookingStart}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="End (HH:mm)"
            value={bookingEnd}
            onChangeText={setBookingEnd}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Purpose"
          value={bookingPurpose}
          onChangeText={setBookingPurpose}
        />
        <TextInput
          style={styles.input}
          placeholder="Contact phone"
          value={bookingPhone}
          onChangeText={setBookingPhone}
        />
        <Button
          title="Submit Booking Request"
          size="small"
          onPress={onCreateBooking}
        />
      </Card>

      <Card style={styles.panelCard}>
        <Text variant="h4">Booking Requests</Text>
        {(bookings || []).length === 0 ? (
          <Text variant="small" style={{ marginTop: 8 }}>
            No booking requests yet.
          </Text>
        ) : (
          (bookings || []).map((row) => (
            <View key={row.id} style={styles.itemRow}>
              <Text variant="body" weight="600">
                {row.facilityName}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {row.bookingDate} | {row.startTime || "TBD"} -{" "}
                {row.endTime || "TBD"}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {row.requesterName || "Member"} | {row.status}
              </Text>

              {isStaff ? (
                <View style={styles.bookingActionRow}>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={() => onUpdateBookingStatus(row.id, "approved")}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="700"
                    >
                      Approve
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={() => onUpdateBookingStatus(row.id, "rejected")}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.error}
                      weight="700"
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text variant="h2">League & Platform</Text>
        <Text variant="small" style={{ marginTop: 3 }}>
          Governing body tools, sponsors, live scores setup and clubhouse hire.
        </Text>
      </View>

      {renderTabBar()}

      <ScrollView contentContainerStyle={styles.content}>
        {tabIndex === 0 ? renderOrganisationTab() : null}
        {tabIndex === 1 ? renderLiveScoreTab() : null}
        {tabIndex === 2 ? renderSponsorsTab() : null}
        {tabIndex === 3 ? renderFacilitiesTab() : null}
      </ScrollView>

      {/* Sponsor Invite Modal */}
      <Modal
        visible={inviteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text variant="h3" style={{ marginBottom: 6 }}>Invite Sponsor</Text>
            {inviteTargetSponsor && (
              <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 10 }}>
                Inviting {inviteTargetSponsor.name} to manage their sponsor page.
              </Text>
            )}
            <Text variant="small" style={{ marginBottom: 4 }}>
              Once accepted, they can update their logo, banner, and create promotions.
              Promotions pushed to the Club Feed require admin approval.
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder="Sponsor email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
              onPress={onSendSponsorInvite}
              disabled={sendingInvite}
            >
              <Text variant="body" weight="700" color={theme.colors.white}>
                {sendingInvite ? "Sending..." : "Send Invite"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { marginTop: 8 }]}
              onPress={() => setInviteModalOpen(false)}
            >
              <Text variant="body" color={theme.colors.textSecondary}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabsWrap: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  tabsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 2,
    paddingBottom: 140,
  },
  panelCard: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginTop: 10,
    color: theme.colors.text,
  },
  multiInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  itemRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  horizontalChips: {
    marginTop: 10,
    marginBottom: 10,
    paddingRight: 10,
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  selectChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  booleanRow: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  booleanDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  scoreEditorRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  scoreInput: {
    width: 44,
    height: 34,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    textAlign: "center",
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inlineAction: {
    marginLeft: 10,
  },
  bookingActionRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  inviteBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignSelf: "flex-start",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  modalBtn: {
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
});
