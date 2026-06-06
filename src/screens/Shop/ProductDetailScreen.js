import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ShoppingBag,
  Minus,
  Plus,
  Maximize2,
  X,
  Package,
  Truck,
  Info,
  ChevronDown,
  ChevronUp,
  Shirt,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useCart } from "../../contexts/CartContext";
import { useClub } from "../../contexts/ClubContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const visibilityLabel = (value) => {
  const normalized = (value || "public").toString().toLowerCase();
  if (normalized === "club" || normalized === "club-only") return "CLUB";
  if (normalized === "network") return "NETWORK";
  return "PUBLIC";
};

const postageOptionLabel = (value) =>
  String(value || "post").toLowerCase() === "pickup"
    ? "Pick Up from Club"
    : "Can Post";

export default function ProductDetailScreen({ navigation, route }) {
  const { product: initialProduct } = route.params || {};
  const cart = useCart();
  const { activeClub } = useClub();
  const insets = useSafeAreaInsets();

  const [product] = useState(initialProduct || {});
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [sizeGuideVisible, setSizeGuideVisible] = useState(false);

  // Build gallery
  const gallery = useMemo(() => {
    const urls = [
      product.imageUrl,
      ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    ]
      .map((url) => String(url || "").trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  }, [product]);

  // Normalize variants
  const variants = useMemo(() => {
    return (product.variants || []).map((v) =>
      typeof v === "object" ? v : { label: v, stock: -1 },
    );
  }, [product]);

  // Selected variant row
  const selectedVariantRow = useMemo(() => {
    if (!selectedVariant) return null;
    return (
      variants.find((v) => {
        const label = typeof v === "object" ? v.label : v;
        return label === selectedVariant;
      }) || null
    );
  }, [variants, selectedVariant]);

  const selectedVariantStock = useMemo(() => {
    const directStock =
      selectedVariantRow && typeof selectedVariantRow === "object"
        ? selectedVariantRow.stock
        : product?.stock;
    const parsed = parseInt(directStock, 10);
    return Number.isFinite(parsed) ? parsed : -1;
  }, [selectedVariantRow, product?.stock]);

  // Auto-select first in-stock variant
  useEffect(() => {
    if (variants.length > 0) {
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
    }
  }, [variants]);

  const navToCart = () => {
    if (cart.itemCount === 0) {
      Alert.alert("Cart", "Your cart is empty.");
    } else {
      navigation.navigate("Cart");
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

  const addToCart = () => {
    const existingQty = (cart.items || []).find(
      (i) =>
        i.productId === product.id &&
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

    cart.addItem(product, selectedVariant, selectedQuantity);
    Alert.alert(
      "Added to Cart! 🛒",
      `${selectedQuantity} × ${product.name} (${selectedVariant}) added to your cart.`,
      [
        { text: "Continue Shopping", style: "cancel" },
        { text: "View Cart", onPress: () => navigation.navigate("Cart") },
      ],
    );
  };

  const priceDisplay =
    typeof product.price === "number"
      ? `$${product.price.toFixed(2)}`
      : product.price || "$0.00";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={26} />
        </TouchableOpacity>
        <Text variant="h4" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
          {product.name || "Product"}
        </Text>
        <TouchableOpacity style={styles.headerIconBtn} onPress={navToCart}>
          <ShoppingBag color={theme.colors.primary} size={24} />
          {cart.itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Main Image */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() =>
            gallery[selectedImageIndex]
              ? setFullscreenImageUrl(gallery[selectedImageIndex])
              : null
          }
          style={styles.mainImageWrap}
        >
          {gallery[selectedImageIndex] ? (
            <Image
              source={{ uri: gallery[selectedImageIndex] }}
              style={styles.mainImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mainImagePlaceholder}>
              <Shirt color={theme.colors.border} size={64} />
            </View>
          )}
          {gallery[selectedImageIndex] ? (
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setFullscreenImageUrl(gallery[selectedImageIndex])}
            >
              <Maximize2 color="#fff" size={16} />
            </TouchableOpacity>
          ) : null}
          {/* Visibility Badge */}
          <View style={[
            styles.visibilityBadge,
            visibilityLabel(product.visibility) === "CLUB" && { backgroundColor: theme.colors.primary },
          ]}>
            <Text style={styles.visibilityBadgeText}>
              {visibilityLabel(product.visibility)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Thumbnail Strip */}
        {gallery.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailRow}
          >
            {gallery.map((uri, idx) => (
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
        )}

        {/* Product Info */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text variant="h2" style={{ marginBottom: 4 }}>
                {product.name}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {product.category || "General"}
                {product.imageOwnerName || product.createdByName
                  ? ` · By ${product.imageOwnerName || product.createdByName}`
                  : ""}
              </Text>
            </View>
            <Text variant="h2" color={theme.colors.primary} style={{ marginLeft: 12 }}>
              {priceDisplay}
            </Text>
          </View>

          {/* Delivery Info */}
          <View style={styles.deliveryRow}>
            <Truck color={theme.colors.textSecondary} size={14} />
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginLeft: 6 }}
            >
              {postageOptionLabel(product.postageOption)}
            </Text>
          </View>
        </View>

        {/* Size Guide */}
        {product.sizeGuideUrl ? (
          <TouchableOpacity
            style={styles.sizeGuideBtn}
            onPress={() => setSizeGuideVisible(true)}
          >
            <Info color={theme.colors.primary} size={14} />
            <Text
              variant="small"
              color={theme.colors.primary}
              weight="700"
              style={{ marginLeft: 6 }}
            >
              Size Guide
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Select Variant / Size */}
        <View style={styles.variantSection}>
          <Text variant="h4" style={{ marginBottom: 4 }}>
            Select Size
          </Text>
          {selectedVariant ? (
            <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
              Selected:{" "}
              <Text variant="small" color={theme.colors.primary} weight="700">
                {selectedVariant}
              </Text>
              {selectedVariantStock >= 0
                ? ` · ${selectedVariantStock} in stock`
                : ""}
            </Text>
          ) : (
            <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
              Please select a size
            </Text>
          )}

          <View style={styles.variantsRow}>
            {(variants.length > 0 ? variants : [{ label: "One Size", stock: -1 }]).map(
              (v) => {
                const label = typeof v === "object" ? v.label : v;
                const variantStock = typeof v === "object" ? v.stock : -1;
                const isOutOfStock = variantStock === 0;
                const stockDisplay =
                  variantStock === -1
                    ? ""
                    : isOutOfStock
                      ? "Out"
                      : `${variantStock}`;

                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.variantChip,
                      selectedVariant === label && styles.variantChipActive,
                      isOutOfStock && styles.variantChipOos,
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
                      weight="700"
                      color={
                        isOutOfStock
                          ? theme.colors.textSecondary
                          : selectedVariant === label
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
                        style={{ marginTop: 2, fontSize: 10 }}
                      >
                        {stockDisplay} left
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </View>

        {/* Description */}
        {product.description ? (
          <View style={styles.detailsSection}>
            <TouchableOpacity
              style={styles.detailsHeader}
              onPress={() => setDetailsExpanded((v) => !v)}
            >
              <Text variant="h4">Description</Text>
              {detailsExpanded ? (
                <ChevronUp color={theme.colors.textSecondary} size={18} />
              ) : (
                <ChevronDown color={theme.colors.textSecondary} size={18} />
              )}
            </TouchableOpacity>
            {detailsExpanded ? (
              <Text
                variant="body"
                color={theme.colors.textSecondary}
                style={{ marginTop: 8, lineHeight: 22 }}
              >
                {product.description}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Product Details */}
        {product.details ? (
          <View style={styles.detailsSection}>
            <Text variant="h4" style={{ marginBottom: 8 }}>
              Product Details
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ lineHeight: 22 }}
            >
              {product.details}
            </Text>
          </View>
        ) : null}

        {/* Packaging Info */}
        <View style={styles.metaRow}>
          <Package color={theme.colors.textSecondary} size={14} />
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginLeft: 6 }}
          >
            {activeClub?.name || "Club"} Store
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Add To Cart Bar */}
      {/* Sticky Add To Cart Bar */}
      <View style={[styles.addToCartBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Quantity Stepper */}
        <View style={styles.qtyStepper}>
          <TouchableOpacity style={styles.qtyBtn} onPress={decreaseQuantity}>
            <Minus color={theme.colors.text} size={18} />
          </TouchableOpacity>
          <View style={styles.qtyValueWrap}>
            <Text variant="h4" weight="700">
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
            <Plus
              color={
                selectedVariantStock >= 0 &&
                selectedQuantity >= selectedVariantStock
                  ? theme.colors.border
                  : theme.colors.text
              }
              size={18}
            />
          </TouchableOpacity>
        </View>

        <Button
          title={
            selectedVariantStock === 0
              ? "Out of Stock"
              : `Add ${selectedQuantity} to Cart`
          }
          onPress={addToCart}
          style={styles.addToCartBtn}
          disabled={selectedVariantStock === 0}
        />
      </View>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={!!fullscreenImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUrl("")}
      >
        <View style={styles.fullscreenOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFullscreenImageUrl("")}
          />
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenImageUrl("")}
          >
            <X color="#fff" size={22} />
          </TouchableOpacity>
          {fullscreenImageUrl ? (
            <Image
              source={{ uri: fullscreenImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* Size Guide Modal */}
      <Modal
        visible={sizeGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSizeGuideVisible(false)}
      >
        <View style={styles.fullscreenOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSizeGuideVisible(false)}
          />
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setSizeGuideVisible(false)}
          >
            <X color="#fff" size={22} />
          </TouchableOpacity>
          {product.sizeGuideUrl ? (
            <Image
              source={{ uri: product.sizeGuideUrl }}
              style={styles.fullscreenImage}
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
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    backgroundColor: theme.colors.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  mainImageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.9,
    backgroundColor: "#F5F5F5",
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  mainImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
  },
  zoomBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  visibilityBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  thumbnailRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  thumbnailWrap: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  thumbnailWrapActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2.5,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
  },
  sizeGuideBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  variantSection: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    marginTop: 8,
  },
  variantsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  variantChip: {
    minWidth: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: "center",
  },
  variantChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  variantChipOos: {
    opacity: 0.4,
  },
  detailsSection: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  addToCartBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  qtyBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  qtyValueWrap: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    height: 44,
  },
  addToCartBtn: {
    flex: 1,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCloseBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
