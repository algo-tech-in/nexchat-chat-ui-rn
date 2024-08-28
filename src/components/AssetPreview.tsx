import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  ImageProps,
  Pressable,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { createVideoThumbnail } from 'react-native-compressor';
import Video, { VideoRef } from 'react-native-video';
import { colors } from '../colors';
import { mediaEvents } from '../events';
import { isMimeTypeVideo } from '../utils';

export const AssetPreview = ({
  url,
  mimeType,
  imageProps,
  containerStyle,
  onPress,
  allowPlayingAsset,
}: {
  url: string;
  mimeType: string;
  imageProps?: ImageProps;
  containerStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  allowPlayingAsset?: boolean;
}) => {
  const videoRef = useRef<VideoRef>(null);
  const isVideo = isMimeTypeVideo(mimeType);
  const [thumbnail, setThumbnail] = useState<string | undefined>(
    isVideo ? undefined : url
  );
  const [showAsset, setShowAsset] = useState(false);
  useEffect(() => {
    if (isVideo) {
      createVideoThumbnail(url).then((response) => {
        setThumbnail(response.path);
      });
    }
  }, [url]);

  useEffect(() => {
    mediaEvents.addListener('media.pause', () => {
      videoRef?.current?.pause();
    });
  }, []);

  const onPressVideoPlay = () => {
    if (allowPlayingAsset) {
      setShowAsset(true);
    }
  };
  return (
    <Pressable style={containerStyle} onPress={onPress}>
      {!showAsset && thumbnail ? (
        <ImageBackground
          source={{ uri: thumbnail }}
          {...imageProps}
          style={[styles.mediaItem, imageProps?.style]}
        >
          {isVideo ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.videoIndicator}
              onPress={onPressVideoPlay}
              disabled={!allowPlayingAsset}
            >
              <View
                style={[
                  {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  allowPlayingAsset
                    ? { height: 50, width: 50 }
                    : { height: 30, width: 30 },
                ]}
              >
                <Image
                  source={require('../assets/play.png')}
                  style={
                    allowPlayingAsset
                      ? { height: 20, width: 20, marginLeft: 4 }
                      : { height: 12, width: 12, marginLeft: 2 }
                  }
                  tintColor={colors.black}
                />
              </View>
            </TouchableOpacity>
          ) : null}
        </ImageBackground>
      ) : null}

      {!showAsset && !thumbnail ? (
        <View
          style={[
            styles.mediaItem,
            imageProps?.style,
            { backgroundColor: colors.paleGray },
          ]}
        />
      ) : null}

      {showAsset && isVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={[styles.mediaItem, imageProps?.style]}
          controls={true}
        />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  mediaItem: {},
  videoIndicator: {
    position: 'absolute',
    zIndex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
