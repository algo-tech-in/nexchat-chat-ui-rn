import _ from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { colors } from '../colors';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';
import { mediaEvents } from '../events';
import { AssetPreview } from './AssetPreview';

export const AssetsCarousel = ({
  assets,
  visible,
  onClose,
  initialIndex = 0,
}: {
  assets: { url: string; mimeType: string }[];
  visible: boolean;
  onClose: () => void;
  initialIndex?: number;
}) => {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
          viewPosition: 0.5,
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  const newIndex = useRef(initialIndex);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<any>[] }) => {
      if (viewableItems.length > 0) {
        const updatedIndex = viewableItems[0].index;
        if (_.isNumber(updatedIndex) && newIndex.current !== updatedIndex) {
          newIndex.current = updatedIndex;
          mediaEvents.emit('media.pause');
        }
      }
    },
    []
  );

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity activeOpacity={0.8} onPress={onClose}>
            <Image
              source={require('../assets/close.png')}
              style={styles.closeButton}
              tintColor={colors.white}
            />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={assets}
          horizontal={true}
          pagingEnabled={true}
          initialNumToRender={assets.length}
          keyExtractor={(item) => `${item.url}`}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item }) => (
            <View style={styles.assetContainer}>
              <AssetPreview
                url={item.url}
                mimeType={item.mimeType}
                containerStyle={styles.assetPreviewContainer}
                imageProps={{
                  style: {
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT * 0.7,
                  },
                  resizeMode: 'contain',
                }}
                allowPlayingAsset={true}
              />
            </View>
          )}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  closeButtonContainer: {
    alignSelf: 'flex-end',
  },
  closeButton: {
    height: 30,
    width: 30,
    alignSelf: 'flex-end',
    marginRight: 20,
    marginTop: 12,
  },
  assetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  assetPreviewContainer: {
    marginBottom: 20,
  },
});
