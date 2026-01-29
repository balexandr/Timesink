import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View, ViewToken } from "react-native";
import { FeedItem } from "../lib/feed";
import { useFeedPrefetch } from "../lib/useFeedPrefetch";

const PLACEHOLDER = require("./assets/history_placeholder.png");
const { width, height } = Dimensions.get("window");

export default function IndexScreen() {
  const { feed, loading, loadMore, queueSize } = useFeedPrefetch({
    initialCount: 5,
    prefetchCount: 10,
    queueMinSize: 15,
    prefetchInterval: 3000,
  });

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    await loadMore();
    // Small delay to show the indicator
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [loadMore]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const lastVisibleIndex = viewableItems[viewableItems.length - 1].index;
      const currentFeedLength = feedRef.current.length;
      
      if (lastVisibleIndex !== null && lastVisibleIndex >= currentFeedLength - 3) {
        console.log(`👀 Near end (index ${lastVisibleIndex}/${currentFeedLength}), loading more`);
        handleLoadMore();
      }
    }
  }, [handleLoadMore]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(({ item }: { item: FeedItem }) => {
    const isPlaceholder = !item.imageUri;

    return (
      <View style={styles.card}>
        <Image
          source={isPlaceholder ? PLACEHOLDER : { uri: item.imageUri }}
          defaultSource={PLACEHOLDER}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={[styles.overlay, isPlaceholder && styles.overlayCenter]}>
          <View style={styles.textBackground}>
            {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.source}>{item.source}</Text>
          </View>
        </View>
        {item.unsplashAttribution && (
          <TouchableOpacity
            style={styles.attribution}
            onPress={() => Linking.openURL(item.unsplashAttribution!.photographerUrl)}
            activeOpacity={0.7}
          >
            <Text style={styles.attributionText}>
              Photo by <Text style={styles.attributionLink}>{item.unsplashAttribution.photographerName}</Text> on{" "}
              <Text style={styles.attributionLink}>Unsplash</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, []);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore && queueSize === 0) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.footerText}>
          {queueSize > 0 ? `Loading more... (${queueSize} ready)` : "Loading..."}
        </Text>
      </View>
    );
  }, [isLoadingMore, queueSize]);

  if (loading && feed.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      removeClippedSubviews={true}
      maxToRenderPerBatch={3}
      windowSize={7}
      initialNumToRender={3}
      ListFooterComponent={renderFooter}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  card: {
    width,
    height,
    backgroundColor: "#000",
  },
  image: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  overlay: {
    position: "absolute",
    bottom: 80,
    paddingHorizontal: 20,
  },
  overlayCenter: {
    bottom: 0,
    top: 0,
    justifyContent: "center",
  },
  textBackground: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 8,
  },
  year: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 6,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  source: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    fontStyle: "italic",
  },
  attribution: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  attributionText: {
    color: "#fff",
    fontSize: 10,
    opacity: 0.9,
  },
  attributionLink: {
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  footer: {
    height,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  footerText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
    opacity: 0.7,
  },
});
