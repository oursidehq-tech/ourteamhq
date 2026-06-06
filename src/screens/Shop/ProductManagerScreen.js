import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Package, Plus, Image as ImageIcon } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import {
  deleteProduct,
  subscribeToProducts,
  updateProduct,
} from "../../services/shopService";
import { updateClub } from "../../services/clubService";
import { uploadProductImage } from "../../services/storageService";

const normalizeVisibility = (value) => {
  const normalized = (value || "club").toString().toLowerCase();
  if (normalized === "public") return "public";
  if (normalized === "network") return "network";
  return "club";
};

const visibilityLabel = (value) => {
  const v = normalizeVisibility(value);
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const normalizePostageOption = (value) => {
  const normalized = (value || "post").toString().trim().toLowerCase();
  if (normalized === "pickup") return "pickup";
  return "post";
};

const postageOptionLabel = (value) =>
  normalizePostageOption(value) === "pickup"
    ? "Pick Up from Club"
    : "Can Post";

export default function ProductManagerScreen({ navigation }) {
  const { activeClubId, activeClub, isClubLeader } = useClub();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [visibility, setVisibility] = useState("club");
  const [imageUri, setImageUri] = useState("");
  const [sizeGuideUri, setSizeGuideUri] = useState("");
  const [postageOption, setPostageOption] = useState("post");
  const [variantsInput, setVariantsInput] = useState("");
  const [shopTaxEnabled, setShopTaxEnabled] = useState(true);
  const [shopTaxRateInput, setShopTaxRateInput] = useState("10");
  const [savingShopSettings, setSavingShopSettings] = useState(false);

  useEffect(() => {
    setShopTaxEnabled(activeClub?.shopTaxEnabled !== false);
    const clubTaxRate = Number(activeClub?.shopTaxRate);
    const normalizedRate =
      Number.isFinite(clubTaxRate) && clubTaxRate >= 0 ? clubTaxRate : 0.1;
    setShopTaxRateInput(String(Math.round(normalizedRate * 100)));
  }, [activeClub?.shopTaxEnabled, activeClub?.shopTaxRate]);

  useEffect(() => {
    if (!activeClubId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeToProducts(
      activeClubId,
      (items) => {
        setProducts(items);
        setLoading(false);
      },
      {
        viewerType: "club",
        includeInactive: true,
      },
    );

    return unsub;
  }, [activeClubId]);

  const activeCount = useMemo(
    () => products.filter((product) => product.active !== false).length,
    [products],
  );

  const openEditor = (product) => {
    setSelected(product);
    setName(product?.name || "");
    setDescription(product?.description || "");
    setDetails(product?.details || "");
    setPrice(String(product?.price ?? ""));
    setCategory(product?.category || "");
    setStock(String(product?.stock ?? -1));
    setVisibility(normalizeVisibility(product?.visibility));
    setImageUri(product?.imageUrl || "");
    setSizeGuideUri(product?.sizeGuideUrl || "");
    setPostageOption(normalizePostageOption(product?.postageOption));
    // Format existing variants for editing
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const formatted = variants
      .filter((v) => v.label && v.label !== "One Size")
      .map((v) => `${v.label}:${v.stock ?? -1}`)
      .join("\n");
    setVariantsInput(formatted);
  };

  const closeEditor = () => {
    if (saving || deleting) return;
    setSelected(null);
  };

  const handleToggleActive = async (product) => {
    if (!activeClubId) return;
    try {
      await updateProduct(activeClubId, product.id, {
        active: product.active === false,
      });
    } catch {
      Alert.alert("Error", "Failed to update product status.");
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePickSizeGuide = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSizeGuideUri(result.assets[0].uri);
    }
  };

  const handleSaveShopSettings = async () => {
    if (!activeClubId) return;

    const parsedPercent = parseFloat(shopTaxRateInput);
    const normalizedPercent = Number.isFinite(parsedPercent)
      ? Math.max(0, Math.min(100, parsedPercent))
      : 10;

    setSavingShopSettings(true);
    try {
      await updateClub(activeClubId, {
        shopTaxEnabled: !!shopTaxEnabled,
        shopTaxRate: normalizedPercent / 100,
      });
      Alert.alert("Saved", "Shop tax settings updated.");
    } catch {
      Alert.alert("Error", "Failed to update shop settings.");
    } finally {
      setSavingShopSettings(false);
    }
  };

  const handleSave = async () => {
    if (!activeClubId || !selected?.id) return;
    if (!name.trim()) {
      Alert.alert("Required", "Product name is required.");
      return;
    }

    const parsedPrice = parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return;
    }

    const parsedStock = parseInt(stock, 10);

    setSaving(true);
    try {
      let uploadedUrl = selected.imageUrl || "";
      if (imageUri && imageUri !== selected.imageUrl && !imageUri.startsWith("http")) {
        uploadedUrl = await uploadProductImage(activeClubId, selected.id, imageUri);
      }

      let uploadedSizeGuideUrl = selected.sizeGuideUrl || "";
      if (
        sizeGuideUri &&
        sizeGuideUri !== selected.sizeGuideUrl &&
        !sizeGuideUri.startsWith("http")
      ) {
        uploadedSizeGuideUrl = await uploadProductImage(
          activeClubId,
          `${selected.id}_size_guide`,
          sizeGuideUri,
        );
      }

      const parsedVariants = variantsInput
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((token) => {
          const [labelPart, stockPart] = token.split(":");
          const label = (labelPart || "").trim();
          const parsedVarStock = parseInt((stockPart || "").trim(), 10);
          return {
            label,
            stock: Number.isFinite(parsedVarStock) ? parsedVarStock : (Number.isFinite(parsedStock) ? parsedStock : -1),
          };
        })
        .filter((v) => !!v.label);

      const finalVariants = parsedVariants.length > 0
        ? parsedVariants
        : [{ label: "One Size", stock: Number.isFinite(parsedStock) ? parsedStock : -1 }];

      await updateProduct(activeClubId, selected.id, {
        name: name.trim(),
        description: description.trim(),
        details: details.trim(),
        price: parsedPrice,
        category: category.trim() || "General",
        stock: Number.isFinite(parsedStock) ? parsedStock : -1,
        visibility: normalizeVisibility(visibility),
        imageUrl: uploadedUrl,
        sizeGuideUrl: uploadedSizeGuideUrl,
        postageOption: normalizePostageOption(postageOption),
        variants: finalVariants,
      });
      setSelected(null);
    } catch {
      Alert.alert("Error", "Failed to save product changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = () => {
    if (!activeClubId || !selected?.id || deleting) return;

    Alert.alert(
      "Delete Product",
      "This will permanently delete this product. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteProduct(activeClubId, selected.id);
              setSelected(null);
            } catch {
              Alert.alert("Error", "Failed to delete product.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (!isClubLeader) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Manage Products</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.restrictedWrap}>
          <Text variant="h4">Owner or admin access only</Text>
          <Text
            variant="body"
            color={theme.colors.textSecondary}
            style={{ marginTop: 8, textAlign: "center" }}
          >
            Product management is available for club leaders.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <Text variant="h3">Manage Products</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            navigation.navigate("CreateItem", {
              title: "Create Product",
              type: "Product",
            })
          }
        >
          <Plus color={theme.colors.primary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <Text variant="small" color={theme.colors.textSecondary}>
            {activeClub?.name || "Club Store"}
          </Text>
          <Text variant="h2" style={{ marginTop: 4 }}>
            {activeCount} Active Products
          </Text>
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginTop: 8 }}
          >
            {products.length - activeCount} Archived
          </Text>
        </Card>

        <Card style={styles.settingsCard}>
          <Text variant="h4">Shop Tax Settings</Text>
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginTop: 4, marginBottom: 10 }}
          >
            Control whether checkout applies tax for this club shop.
          </Text>

          <View style={styles.segmentRow}>
            {[
              { key: true, label: "Tax On" },
              { key: false, label: "Tax Off" },
            ].map((option) => (
              <TouchableOpacity
                key={String(option.key)}
                style={[
                  styles.segmentBtn,
                  shopTaxEnabled === option.key && styles.segmentBtnActive,
                ]}
                onPress={() => setShopTaxEnabled(option.key)}
              >
                <Text
                  variant="small"
                  weight="600"
                  color={
                    shopTaxEnabled === option.key
                      ? theme.colors.white
                      : theme.colors.text
                  }
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {shopTaxEnabled ? (
            <>
              <Text variant="small" style={styles.modalLabel}>
                Tax Rate (%)
              </Text>
              <TextInput
                style={styles.input}
                value={shopTaxRateInput}
                onChangeText={setShopTaxRateInput}
                keyboardType="decimal-pad"
                placeholder="10"
              />
            </>
          ) : null}

          <Button
            title={savingShopSettings ? "Saving..." : "Save Shop Settings"}
            size="small"
            onPress={handleSaveShopSettings}
            disabled={savingShopSettings}
            style={{ width: "100%" }}
          />
        </Card>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: 80 }}
          />
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Package color={theme.colors.border} size={44} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: 12 }}
            >
              No products yet
            </Text>
            <Button
              title="Create First Product"
              onPress={() =>
                navigation.navigate("CreateItem", {
                  title: "Create Product",
                  type: "Product",
                })
              }
              style={{ marginTop: 16, width: 220 }}
            />
          </View>
        ) : (
          products.map((product) => (
            <Card key={product.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="h4">{product.name || "Product"}</Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {product.category || "General"}
                  </Text>
                </View>
                <Text variant="h4" color={theme.colors.primary}>
                  ${(Number(product.price) || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Visibility: {visibilityLabel(product.visibility)}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Stock: {Number.isFinite(product.stock) ? product.stock : "∞"}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Postage: {postageOptionLabel(product.postageOption)}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {product.sizeGuideUrl ? "Size guide: Added" : "Size guide: None"}
                </Text>
              </View>

              {product.description ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginBottom: 8 }}
                  numberOfLines={2}
                >
                  {product.description}
                </Text>
              ) : null}

              {Array.isArray(product.variants) && product.variants.length > 0 && (
                <View style={styles.variantStockRow}>
                  {product.variants
                    .filter((v) => v.label && v.label !== "One Size")
                    .map((v, idx) => (
                      <View key={idx} style={styles.variantStockChip}>
                        <Text variant="small" weight="600" color={theme.colors.text}>
                          {v.label}
                        </Text>
                        <Text variant="small" color={v.stock === 0 ? theme.colors.error : theme.colors.textSecondary}>
                          {v.stock === -1 ? "∞" : v.stock ?? "∞"}
                        </Text>
                      </View>
                    ))}
                </View>
              )}

              <View style={styles.metaRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {`Owner: ${product.imageOwnerName || product.createdByName || "Unknown"}`}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  variant="small"
                  color={
                    product.active === false
                      ? theme.colors.error
                      : theme.colors.primary
                  }
                >
                  {product.active === false ? "Archived" : "Active"}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <Button
                  title="Edit"
                  variant="outline"
                  onPress={() => openEditor(product)}
                  style={styles.actionBtn}
                />
                <Button
                  title={product.active === false ? "Restore" : "Archive"}
                  variant={product.active === false ? "primary" : "outline"}
                  onPress={() => handleToggleActive(product)}
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeEditor} />
          <View style={styles.modalContent}>
            <Text variant="h3" style={{ marginBottom: 12 }}>
              Edit Product
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>

            <TouchableOpacity
              style={styles.imageSelector}
              onPress={handlePickImage}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ImageIcon color={theme.colors.textSecondary} size={32} />
                  <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>
                    Edit Image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text variant="small" style={styles.modalLabel}>
              Name
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
            />

            <Text variant="small" style={styles.modalLabel}>
              Description
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 84, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <Text variant="small" style={styles.modalLabel}>
              Product Details
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 96, textAlignVertical: "top" }]}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={5}
            />

            <Text variant="small" style={styles.modalLabel}>
              Price
            </Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />

            <Text variant="small" style={styles.modalLabel}>
              Category
            </Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
            />

            <Text variant="small" style={styles.modalLabel}>
              Size Guide Image
            </Text>
            <TouchableOpacity
              style={styles.imageSelector}
              onPress={handlePickSizeGuide}
            >
              {sizeGuideUri ? (
                <Image
                  source={{ uri: sizeGuideUri }}
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ImageIcon color={theme.colors.textSecondary} size={32} />
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 8 }}
                  >
                    Add Size Guide Image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text variant="small" style={styles.modalLabel}>
              Sizes / Variants (with stock)
            </Text>
            <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 6 }}>
              One per line — Size:Stock (e.g. S:8, M:10, L:5)
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
              value={variantsInput}
              onChangeText={setVariantsInput}
              placeholder={"S:8\nM:10\nL:5\nXL:3"}
              multiline
              numberOfLines={5}
            />

            <Text variant="small" style={styles.modalLabel}>
              Fallback Stock (-1 = unlimited)
            </Text>
            <TextInput
              style={styles.input}
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
            />

            <Text variant="small" style={styles.modalLabel}>
              Visibility
            </Text>
            <View style={styles.segmentRow}>
              {["club", "network", "public"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentBtn,
                    visibility === option && styles.segmentBtnActive,
                  ]}
                  onPress={() => setVisibility(option)}
                >
                  <Text
                    variant="small"
                    weight="600"
                    color={
                      visibility === option
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text variant="small" style={styles.modalLabel}>
              Postage Option
            </Text>
            <View style={styles.segmentRow}>
              {[
                { key: "post", label: "Can Post" },
                { key: "pickup", label: "Pick Up" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.segmentBtn,
                    postageOption === option.key && styles.segmentBtnActive,
                  ]}
                  onPress={() => setPostageOption(option.key)}
                >
                  <Text
                    variant="small"
                    weight="600"
                    color={
                      postageOption === option.key
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="small"
                onPress={closeEditor}
                style={styles.modalBtn}
                disabled={saving || deleting}
              />
              <Button
                title={deleting ? "..." : "Delete"}
                variant="outline"
                size="small"
                onPress={handleDeleteSelected}
                style={styles.modalBtn}
                disabled={saving || deleting}
              />
              <Button
                title={saving ? "..." : "Save"}
                size="small"
                onPress={handleSave}
                style={styles.modalBtn}
                disabled={saving || deleting}
              />
            </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 40,
    padding: theme.spacing.xs,
  },
  addBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  restrictedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  summaryCard: {
    marginBottom: theme.spacing.md,
  },
  settingsCard: {
    marginBottom: theme.spacing.md,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.lg,
  },
  productCard: {
    marginBottom: theme.spacing.sm,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    paddingBottom: 32,
  },
  imageSelector: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  modalLabel: {
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  segmentRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: theme.spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
  variantStockRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  variantStockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
