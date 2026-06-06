import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Shirt,
  Check,
  Camera,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { theme } from "../theme/theme";
import { useClub } from "../contexts/ClubContext";
import { useCart } from "../contexts/CartContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import { subscribeToProducts } from "../services/shopService";
import { updateClub } from "../services/clubService";
import { uploadClubBanner } from "../services/storageService";
import * as ImagePicker from "expo-image-picker";

const visibilityLabel = (value) => {
  const normalized = (value || "public").toString().toLowerCase();
  if (normalized === "club" || normalized === "club-only") return "CLUB";
  if (normalized === "network") return "NETWORK";
  return "PUBLIC";
};

export default function ShopScreen({ navigation }) {
  const { activeClubId, activeClub, userRole } = useClub();
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const canEditStoreBanner =
    normalizedRole === "owner" ||
    normalizedRole === "admin" ||
    normalizedRole === "coach" ||
    normalizedRole === "manager";
  const { setCollapsed } = useTabBarAnimation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingBanner, setUpdatingBanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sizeGuidePreviewUrl, setSizeGuidePreviewUrl] = useState("");

  const normalizeCategory = (value) => String(value || "").trim().toLowerCase();

  const isApparelCategory = (value) => {
    const v = normalizeCategory(value);
    return ["apparel", "jersey", "shirt", "kit", "uniform", "clothing"].some(
      (token) => v.includes(token),
    );
  };

  const isGearCategory = (value) => {
    const v = normalizeCategory(value);
    return ["gear", "equipment", "ball", "training", "accessory", "boot"].some(
      (token) => v.includes(token),
    );
  };

  const filteredProducts = useMemo(() => {
    if (activeCategory === "apparel") {
      return (products || []).filter((p) => isApparelCategory(p?.category));
    }
    if (activeCategory === "gear") {
      return (products || []).filter((p) => isGearCategory(p?.category));
    }
    return products || [];
  }, [products, activeCategory]);

  const selectedGallery = useMemo(() => {
    if (!selectedProduct) return [];
    const gallery = [
      selectedProduct.imageUrl,
      ...(Array.isArray(selectedProduct.imageUrls)
        ? selectedProduct.imageUrls
        : []),
    ]
      .map((url) => String(url || "").trim())
      .filter(Boolean);

    return Array.from(new Set(gallery));
  }, [selectedProduct]);

  const selectedVariantRow = useMemo(() => {
    if (!selectedProduct || !selectedVariant) return null;
    const variants = Array.isArray(selectedProduct.variants)
      ? selectedProduct.variants
      : [];
    return (
      variants.find((v) => {
        const label = typeof v === "object" ? v.label : v;
        return label === selectedVariant;
      }) || null
    );
  }, [selectedProduct, selectedVariant]);

  const selectedVariantStock = useMemo(() => {
    const directStock =
      selectedVariantRow && typeof selectedVariantRow === "object"
        ? selectedVariantRow.stock
        : selectedProduct?.stock;
    const parsed = parseInt(directStock, 10);
    return Number.isFinite(parsed) ? parsed : -1;
  }, [selectedVariantRow, selectedProduct?.stock]);

  useFocusEffect(
    useCallback(() => {
      setCollapsed(false);
      return () => setCollapsed(false);
    }, [setCollapsed]),
  );

  const handleTabBarScroll = useCallback(
    (event) => {
      const offsetY = event?.nativeEvent?.contentOffset?.y || 0;
      setCollapsed(offsetY > 24);
    },
    [setCollapsed],
  );

  useEffect(() => {
    if (!activeClubId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToProducts(
      activeClubId,
      (newProducts) => {
        setProducts(newProducts);
        setLoading(false);
      },
      {
        viewerType: "club",
      },
    );
    return unsubscribe;
  }, [activeClubId]);

  useEffect(() => {
    const enabled = activeClub?.shopTaxEnabled !== false;
    const rate = Number(activeClub?.shopTaxRate);
    const normalizedRate = Number.isFinite(rate) && rate >= 0 ? rate : 0.1;
    cart.setTaxConfig({
      enabled,
      rate: normalizedRate,
    });
  }, [activeClub?.shopTaxEnabled, activeClub?.shopTaxRate]);

  useEffect(() => {
    const onBackPress = () => {
      if (sizeGuidePreviewUrl) {
        setSizeGuidePreviewUrl("");
        return true;
      }

      if (selectedProduct) {
        setSelectedProduct(null);
        setSelectedVariant(null);
        setSelectedQuantity(1);
        setSelectedImageIndex(0);
        return true;
      }

      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [sizeGuidePreviewUrl, selectedProduct]);

  const navToCart = () => {
    if (cart.itemCount === 0) {
      Alert.alert("Cart", "Your cart is empty.");
    } else {
      navigation.navigate("Cart");
    }
  };

  const openProductDetail = (product) => {
    const variants = (product.variants || []).map((v) =>
      typeof v === "object" ? v : { label: v, stock: -1 },
    );
    navigation.navigate("ProductDetail", { product: { ...product, variants } });
  };

  const openVariantModal = (product) => {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
    setSelectedQuantity(1);
    const variants = product.variants || [];
    // Auto-select first in-stock variant
    const firstInStock = variants.find((v) => {
      const stock = typeof v === "object" ? v.stock : -1;
      return stock !== 0;
    });
    const firstVariant = firstInStock || variants[0];
    setSelectedVariant(
      typeof firstVariant === "object"
        ? firstVariant.label
        : firstVariant || "One Size",
    );
  };

  const addToCart = () => {
    if (selectedProduct) {
      const existingQty = (cart.items || []).find(
        (i) =>
          i.productId === selectedProduct.id &&
          String(i.variant || "") === String(selectedVariant || ""),
      )?.quantity;
      const currentQty = Number(existingQty) || 0;

      if (
        selectedVariantStock >= 0 &&
        currentQty + selectedQuantity > selectedVariantStock
      ) {
        Alert.alert(
          "Stock Limit",
          `Only ${selectedVariantStock} available for this size.`,
        );
        return;
      }

      cart.addItem(selectedProduct, selectedVariant, selectedQuantity);
      Alert.alert(
        "Added!",
        `${selectedQuantity} x ${selectedProduct.name} added to cart.`,
      );
      setSelectedProduct(null);
      setSelectedVariant(null);
      setSelectedQuantity(1);
      setSelectedImageIndex(0);
      setFullscreenImageUrl("");
    }
  };

  const increaseQuantity = () => {
    setSelectedQuantity((prev) => {
      if (selectedVariantStock >= 0) {
        return Math.min(selectedVariantStock, prev + 1);
      }
      return prev + 1;
    });
  };

  const decreaseQuantity = () => {
    setSelectedQuantity((prev) => Math.max(1, prev - 1));
  };

  const postageOptionLabel = (value) =>
    String(value || "post").toLowerCase() === "pickup"
      ? "Pick Up from Club"
      : "Can Post";

  const handleEditStoreBanner = async () => {
    if (!activeClubId || updatingBanner) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please enable media library access to update the store banner.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
      aspect: [16, 9],
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUpdatingBanner(true);
    try {
      const bannerUrl = await uploadClubBanner(activeClubId, result.assets[0].uri);
      if (!bannerUrl) {
        throw new Error("No banner URL returned from upload.");
      }
      await updateClub(activeClubId, {
        storeBannerUrl: bannerUrl,
      });
      Alert.alert("Updated", "Store banner updated successfully.");
    } catch {
      Alert.alert("Error", "Could not update store banner right now.");
    } finally {
      setUpdatingBanner(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Avatar
            source={
              activeClub?.logoUrl
                ? { uri: activeClub.logoUrl }
                : {
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(activeClub?.name || "Shop")}&background=108B51&color=fff&size=150`,
                  }
            }
            size={40}
            isClub
          />
          <View style={styles.titleInfo}>
            <Text variant="h3">{activeClub?.name || "Shop"}</Text>
            <Text variant="small">Club Store</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Search")}
          >
            <Search color={theme.colors.text} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cartBtn} onPress={navToCart}>
            <ShoppingBag color={theme.colors.primary} size={24} />
            {cart.itemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text
                  variant="small"
                  style={{
                    color: theme.colors.white,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {cart.itemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.banner}>
            <Image
              source={{
                uri:
                  activeClub?.storeBannerUrl ||
                  activeClub?.bannerUrl ||
                  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=800&auto=format&fit=crop",
              }}
              style={styles.bannerImage}
            />
            <View style={styles.bannerContent}>
              <Badge
                text="NEW SEASON"
                variant="outline"
                style={{ borderColor: theme.colors.white }}
              />
              <View style={{ marginTop: 16 }}>
                <Text variant="h2" color={theme.colors.white}>
                  2024 Home Kit
                </Text>
                <Text
                  variant="small"
                  color={theme.colors.white}
                  style={{ marginTop: 4 }}
                >
                  Engineered for performance
                </Text>
              </View>

              {canEditStoreBanner ? (
                <TouchableOpacity
                  style={styles.editBannerBtn}
                  onPress={handleEditStoreBanner}
                  disabled={updatingBanner}
                >
                  {updatingBanner ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <Camera color={theme.colors.white} size={14} />
                      <Text
                        variant="small"
                        color={theme.colors.white}
                        weight="600"
                        style={{ marginLeft: 6 }}
                      >
                        Edit Banner
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.categoriesSection}>
          <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
            Shop by Category
          </Text>
          <View style={styles.categoriesRow}>
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() =>
                setActiveCategory((prev) =>
                  prev === "apparel" ? "all" : "apparel",
                )
              }
            >
              <View style={styles.categoryIconContainer}>
                <Shirt color={theme.colors.primary} size={24} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text variant="h4">Apparel</Text>
                <Text variant="small">Jerseys, Shorts</Text>
              </View>
              {activeCategory === "apparel" ? (
                <View style={styles.categorySelectedDot} />
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() =>
                setActiveCategory((prev) => (prev === "gear" ? "all" : "gear"))
              }
            >
              <View style={styles.categoryIconContainer}>
                <Check color={theme.colors.primary} size={24} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text variant="h4">Gear</Text>
                <Text variant="small">Balls, Training</Text>
              </View>
              {activeCategory === "gear" ? (
                <View style={styles.categorySelectedDot} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Products */}
        <View style={styles.featuredSection}>
          <View style={styles.sectionHeader}>
            <Text variant="h4">
              {activeCategory === "apparel"
                ? "Apparel"
                : activeCategory === "gear"
                  ? "Gear"
                  : "Featured Products"}
            </Text>
            <TouchableOpacity onPress={() => setActiveCategory("all")}>
              <Text variant="small" color={theme.colors.primary} weight="600">
                View All
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productsGrid}>
            {loading ? (
              <ActivityIndicator
                size="large"
                color={theme.colors.primary}
                style={{ width: "100%", marginTop: theme.spacing.xl * 2 }}
              />
            ) : filteredProducts.length === 0 ? (
              <View
                style={{
                  width: "100%",
                  alignItems: "center",
                  marginTop: theme.spacing.xl * 2,
                  paddingBottom: theme.spacing.xl * 2,
                }}
              >
                <ShoppingBag color={theme.colors.border} size={48} />
                <Text
                  variant="h4"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: theme.spacing.md, textAlign: "center" }}
                >
                  Shop is empty.
                </Text>
                <Text
                  variant="body"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: 4, textAlign: "center" }}
                >
                  {activeCategory === "apparel"
                    ? "No apparel products yet."
                    : activeCategory === "gear"
                      ? "No gear products yet."
                      : "Check back later for new gear and apparel."}
                </Text>
              </View>
            ) : (
              filteredProducts.map((item) => {
                const priceDisplay =
                  typeof item.price === "number"
                    ? `$${item.price.toFixed(2)}`
                    : item.price;
                const variants = (item.variants || []).map((v) =>
                  typeof v === "object" ? v : { label: v, stock: -1 },
                );
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.productCard}
                    onPress={() => openProductDetail({ ...item, variants })}
                  >
                    <View style={styles.productImageContainer}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.productImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.productImage,
                            {
                              backgroundColor: theme.colors.border,
                              justifyContent: "center",
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Shirt color={theme.colors.textSecondary} size={32} />
                        </View>
                      )}
                      <View
                        style={[
                          styles.productBadge,
                          visibilityLabel(item.visibility) === "CLUB" && {
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                      >
                        <Text
                          variant="small"
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: theme.colors.white,
                          }}
                        >
                          {visibilityLabel(item.visibility)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => openProductDetail({ ...item, variants })}
                      >
                        <Plus color={theme.colors.white} size={20} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.productInfo}>
                      <Text
                        variant="body"
                        weight="600"
                        style={{ marginBottom: 4 }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginBottom: 8 }}
                      >
                        {item.category}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginBottom: 8 }}
                      >
                        {`By ${item.imageOwnerName || item.createdByName || activeClub?.name || "Club"}`}
                      </Text>
                      <Text variant="h4" color={theme.colors.primary}>
                        {priceDisplay}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Variant Selection Modal */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedProduct(null);
          setSelectedVariant(null);
          setSelectedQuantity(1);
          setSelectedImageIndex(0);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setSelectedProduct(null);
              setSelectedVariant(null);
              setSelectedQuantity(1);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {selectedProduct && (
              <>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text variant="h3" style={{ marginBottom: 6 }}>
                    {selectedProduct.name}
                  </Text>
                  <Text variant="h4" color={theme.colors.primary}>
                    ${Number(selectedProduct.price || 0).toFixed(2)}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 6 }}
                  >
                    {selectedProduct.category || "General"}
                  </Text>

                  {/* Hero image — tap to view fullscreen */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      selectedGallery[selectedImageIndex]
                        ? setFullscreenImageUrl(
                            selectedGallery[selectedImageIndex],
                          )
                        : null
                    }
                    style={styles.modalHeroImageWrap}
                  >
                    {selectedGallery[selectedImageIndex] ? (
                      <Image
                        source={{ uri: selectedGallery[selectedImageIndex] }}
                        style={styles.modalHeroImage}
                      />
                    ) : (
                      <View style={styles.modalHeroPlaceholder}>
                        <Shirt color={theme.colors.textSecondary} size={42} />
                      </View>
                    )}
                    {selectedGallery[selectedImageIndex] ? (
                      <View style={styles.heroZoomHint}>
                        <Text style={styles.heroZoomHintText}>Tap to zoom</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  {/* Thumbnail strip (shown when >1 image) */}
                  {selectedGallery.length > 1 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.thumbnailRow}
                    >
                      {selectedGallery.map((uri, idx) => (
                        <TouchableOpacity
                          key={`${uri}_${idx}`}
                          style={[
                            styles.thumbnailWrap,
                            selectedImageIndex === idx && styles.thumbnailWrapActive,
                          ]}
                          onPress={() => setSelectedImageIndex(idx)}
                        >
                          <Image source={{ uri }} style={styles.thumbnailImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}

                  {/* Admin-only: Visibility / Delivery / Stock */}
                  {canEditStoreBanner ? (
                    <View style={styles.productMetaCard}>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {`Visibility: ${visibilityLabel(selectedProduct.visibility)}`}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 4 }}
                      >
                        {`Delivery: ${postageOptionLabel(selectedProduct.postageOption)}`}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 4 }}
                      >
                        {selectedVariantStock >= 0
                          ? `Stock: ${selectedVariantStock}`
                          : "Stock: Unlimited"}
                      </Text>
                    </View>
                  ) : null}

                  {selectedProduct.description ? (
                    <View style={styles.detailsBlock}>
                      <Text variant="h4">Description</Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 6, lineHeight: 20 }}
                      >
                        {selectedProduct.description}
                      </Text>
                    </View>
                  ) : null}

                  {selectedProduct.details ? (
                    <View style={styles.detailsBlock}>
                      <Text variant="h4">Details</Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 6, lineHeight: 20 }}
                      >
                        {selectedProduct.details}
                      </Text>
                    </View>
                  ) : null}

                  {selectedProduct.sizeGuideUrl ? (
                    <TouchableOpacity
                      onPress={() =>
                        setSizeGuidePreviewUrl(selectedProduct.sizeGuideUrl)
                      }
                      style={styles.sizeGuideBtn}
                    >
                      <Text variant="small" color={theme.colors.primary} weight="700">
                        Open Size Guide
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Sizes section */}
                  <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
                    Sizes
                  </Text>
                  <View style={styles.variantsRow}>
                    {(selectedProduct.variants || ["One Size"]).map((v) => {
                      const label = typeof v === "object" ? v.label : v;
                      const variantStock = typeof v === "object" ? v.stock : -1;
                      const isOutOfStock = variantStock === 0;
                      const stockDisplay =
                        variantStock === -1
                          ? ""
                          : isOutOfStock
                            ? "Out of Stock"
                            : `${variantStock} left`;
                      return (
                        <TouchableOpacity
                          key={label}
                          style={[
                            styles.variantChip,
                            selectedVariant === label && styles.variantChipActive,
                            isOutOfStock && { opacity: 0.4 },
                          ]}
                          onPress={() => {
                            if (!isOutOfStock) {
                              setSelectedVariant(label);
                              setSelectedQuantity(1);
                            }
                          }}
                          disabled={isOutOfStock}
                        >
                          <Text
                            variant="body"
                            weight="600"
                            color={
                              selectedVariant === label
                                ? theme.colors.white
                                : theme.colors.text
                            }
                          >
                            {label}
                          </Text>
                          {stockDisplay ? (
                            <Text
                              variant="small"
                              color={
                                isOutOfStock
                                  ? theme.colors.error
                                  : selectedVariant === label
                                    ? "rgba(255,255,255,0.8)"
                                    : theme.colors.textSecondary
                              }
                              style={{ marginTop: 2, fontSize: 11 }}
                            >
                              {stockDisplay}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={styles.addToCartBar}>
                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={decreaseQuantity}
                    >
                      <Minus color={theme.colors.text} size={16} />
                    </TouchableOpacity>
                    <View style={styles.qtyValueWrap}>
                      <Text variant="body" weight="700">
                        {selectedQuantity}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={increaseQuantity}
                      disabled={
                        selectedVariantStock >= 0 &&
                        selectedQuantity >= selectedVariantStock
                      }
                    >
                      <Plus color={theme.colors.text} size={16} />
                    </TouchableOpacity>
                  </View>

                  <Button
                    title={`Add ${selectedQuantity} to Cart`}
                    onPress={addToCart}
                    style={styles.addToCartMainBtn}
                    disabled={selectedVariantStock === 0}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!sizeGuidePreviewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setSizeGuidePreviewUrl("")}
      >
        <View style={styles.sizeGuideOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSizeGuidePreviewUrl("")}
          />
          {sizeGuidePreviewUrl ? (
            <Image
              source={{ uri: sizeGuidePreviewUrl }}
              style={styles.sizeGuideImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* Fullscreen image viewer */}
      <Modal
        visible={!!fullscreenImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUrl("")}
      >
        <View style={styles.sizeGuideOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFullscreenImageUrl("")}
          />
          {fullscreenImageUrl ? (
            <Image
              source={{ uri: fullscreenImageUrl }}
              style={styles.sizeGuideImage}
              resizeMode="contain"
            />
          ) : null}
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
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleInfo: {
    marginLeft: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: theme.spacing.sm,
  },
  cartBtn: {
    padding: theme.spacing.sm,
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: theme.colors.primary, // using green
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  bannerContainer: {
    padding: theme.spacing.md,
  },
  banner: {
    height: 180,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  bannerContent: {
    padding: theme.spacing.lg,
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  editBannerBtn: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoriesSection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginHorizontal: 4,
  },
  categorySelectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: "auto",
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredSection: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: theme.spacing.md,
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: "48%",
    marginBottom: theme.spacing.lg,
  },
  productImageContainer: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F0F0F0",
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    position: "relative",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  productBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.small,
  },
  productInfo: {
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "92%",
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.md,
  },
  modalHeroImageWrap: {
    width: "100%",
    height: 250,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  modalHeroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  modalHeroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailRow: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  thumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  thumbnailWrapActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  productMetaCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  detailsBlock: {
    marginBottom: theme.spacing.sm,
  },
  variantsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  variantChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  variantChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sizeGuideBtn: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing.md,
    paddingVertical: 6,
  },
  addToCartBar: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    marginRight: theme.spacing.sm,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  qtyValueWrap: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addToCartMainBtn: {
    flex: 1,
  },
  sizeGuideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  sizeGuideImage: {
    width: "100%",
    height: "80%",
    borderRadius: theme.radius.md,
  },
  heroZoomHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  heroZoomHintText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
