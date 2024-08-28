import { Message, NexChat } from '@nexchat/client-js';
import { SendMessageProps } from 'client-js/src/types';
import _ from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  backgroundUpload,
  Image as ImageCompress,
  UploadType,
  Video,
} from 'react-native-compressor';
import {
  Asset,
  CameraType,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { colors } from './colors';
import { AssetPreview } from './components/AssetPreview';
import { IMAGE_COMPRESS_CONFIG, IS_IOS } from './constants';
import { FulfilledLinkPreview } from './types';
import { fetchUrlsToPreview, isMimeTypeVideo } from './utils';

type UserReplyInputType = {
  client: NexChat;
  onPressSend: (props: SendMessageProps) => Promise<Message>;
  isLoading?: boolean;
  autoFocus?: boolean;
};

const UserTextInput = ({
  client,
  onPressSend,
  isLoading = false,
  autoFocus = false,
}: UserReplyInputType) => {
  const [text, setText] = useState('');
  const [urlToPreview, setUrlToPreview] = useState<
    FulfilledLinkPreview | undefined
  >(undefined);
  const [urlImageHasError, setUrlImageHasError] = useState<boolean>(false);
  const [isLoadingUrlPreview, setIsLoadingUrlPreview] =
    useState<boolean>(false);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [localMediaList, setLocalMediaList] = useState<Asset[]>([]);
  const [isMessageBeingSent, setIsMessageBeingSent] = useState<boolean>(false);
  const [isAssetProcessing, setIsAssetProcessing] = useState<boolean>(false);

  const onChangeText = (inputText: string) => {
    if (isLoading || isMessageBeingSent) {
      return;
    }
    setText(inputText);
  };

  const isMessageOnSendBeignProcessed = useRef(false);
  const onSend = async () => {
    if (isMessageOnSendBeignProcessed.current) {
      return;
    }
    if (_.isEmpty(text) && _.isEmpty(localMediaList)) {
      return;
    }
    setIsMessageBeingSent(true);
    isMessageOnSendBeignProcessed.current = true;
    let uploadResponse = undefined;
    if (!_.isEmpty(localMediaList)) {
      uploadResponse = await uploadSelectedMedia();
    }
    onPressSend({
      text,
      attachments: uploadResponse,
      urlPreview: _.isEmpty(urlToPreview)
        ? []
        : ([urlToPreview] as FulfilledLinkPreview[]),
    })
      .then(() => {
        setText('');
        setLocalMediaList([]);
        setUrlToPreview(undefined);
        handleUrlPreviewWithDebounce.cancel();
      })
      .finally(() => {
        setIsMessageBeingSent(false);
        isMessageOnSendBeignProcessed.current = false;
      });
  };

  const openCamera = (cameraType: CameraType) => {
    setShowAddMedia(false);
    setIsAssetProcessing(true);
    launchCamera({
      mediaType: 'mixed',
      quality: 0.8,
      cameraType: cameraType,
      formatAsMp4: true,
    })
      .then((mediaResponse) => {
        updateSelectedMediaList(mediaResponse);
      })
      .catch((error) => console.log(error))
      .finally(() => setIsAssetProcessing(false));
  };

  const openGallery = () => {
    setShowAddMedia(false);
    setIsAssetProcessing(true);
    launchImageLibrary({
      mediaType: 'mixed',
      quality: 0.8,
      selectionLimit: 0,
      formatAsMp4: true,
    })
      .then((mediaResponse) => {
        updateSelectedMediaList(mediaResponse);
      })
      .catch((error) => console.log(error))
      .finally(() => setIsAssetProcessing(false));
  };

  const updateSelectedMediaList = (mediaResponse: ImagePickerResponse) => {
    mediaResponse.assets?.forEach((asset) => {
      if (asset.uri) {
        setLocalMediaList((oldList) => [...oldList, asset]);
      }
    });
  };

  console.log(localMediaList);

  const uploadSelectedMedia = async () => {
    const metadata = _.map(localMediaList, (mediaItem) => {
      if (!mediaItem.uri || !mediaItem.type) {
        return undefined;
      }
      return {
        mimeType: mediaItem.type,
        fileUri: mediaItem.uri,
      };
    });
    const cleanedMetadata = _.compact(metadata);

    const signedUrlList = await client.createUploadUrlsAsync({
      metadata: cleanedMetadata,
    });

    const uploadPromises = _.map(signedUrlList, async (signedUrl) => {
      let compressedUri = signedUrl.uri;
      if (isMimeTypeVideo(signedUrl.mimeType)) {
        compressedUri = await Video.compress(signedUrl.uri);
      } else {
        compressedUri = await ImageCompress.compress(
          signedUrl.uri,
          IMAGE_COMPRESS_CONFIG
        );
      }

      await backgroundUpload(signedUrl.url, compressedUri, {
        uploadType: UploadType.BINARY_CONTENT, // TODO: Change to MULTIPART
        // fieldName: signedUrl.fileId, TODO: ADD WITH MULTIPART
        mimeType: signedUrl.mimeType,
        httpMethod: 'PUT',
        headers: {
          'Content-Type': signedUrl.mimeType,
        },
      });
    });

    await Promise.all(uploadPromises);

    return signedUrlList;
  };

  useEffect(() => {
    if (!_.isEmpty(text)) {
      handleUrlPreviewWithDebounce({
        text,
        urlToPreview,
        setUrlToPreview,
        setIsLoadingUrlPreview,
      });
    }
  }, [text]);

  return (
    <KeyboardAvoidingView
      enabled={IS_IOS}
      behavior="padding"
      keyboardVerticalOffset={120}
    >
      <View style={styles.container}>
        {!_.isEmpty(localMediaList) && (
          <ScrollView
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            horizontal={true}
            style={styles.mediaScrollView}
            contentContainerStyle={styles.mediaScrollViewContentContainer}
          >
            {_.map(localMediaList, (mediaItem, index) => {
              return (
                <View
                  key={`${mediaItem.uri}-${index}`}
                  style={styles.mediaItemContainer}
                >
                  {mediaItem.uri && mediaItem.type ? (
                    <AssetPreview
                      url={mediaItem.uri}
                      mimeType={mediaItem.type}
                      imageProps={{
                        style: styles.assetPreviewImage,
                      }}
                    />
                  ) : null}
                  <Pressable
                    onPress={() => {
                      const newLocalMediaList = [...localMediaList];
                      newLocalMediaList.splice(index, 1);
                      setLocalMediaList(newLocalMediaList);
                    }}
                    style={[
                      styles.deleteButton,
                      { display: isMessageBeingSent ? 'none' : 'flex' },
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>+</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}

        <Pressable
          onPress={() => {
            if (urlToPreview?.url) {
              Linking.openURL(urlToPreview?.url).catch(() => {});
            }
          }}
          style={[
            styles.urlPreviewContainer,
            {
              display:
                isLoadingUrlPreview ||
                (!_.isEmpty(urlToPreview) && !_.isEmpty(urlToPreview?.title))
                  ? 'flex'
                  : 'none',
            },
          ]}
        >
          {!urlImageHasError && !_.isEmpty(urlToPreview?.images?.[0]) && (
            <View style={styles.urlPreviewImageContainer}>
              <Image
                source={{ uri: urlToPreview?.images?.[0] }}
                style={styles.urlPreviewImage}
                resizeMode={'contain'}
                onLoadStart={setUrlImageHasError.bind(this, false)}
                onError={setUrlImageHasError.bind(this, true)}
              />
            </View>
          )}

          <View style={styles.urlPreviewTextContainer}>
            <Text numberOfLines={1} style={styles.urlPreviewTitle}>
              {urlToPreview?.title}
            </Text>
            {!_.isEmpty(urlToPreview?.description) && (
              <Text numberOfLines={2}>{urlToPreview?.description}</Text>
            )}
          </View>

          {isLoadingUrlPreview && (
            <ActivityIndicator
              animating={true}
              size={'small'}
              color={colors.white}
              style={styles.urlPreviewActivityIndicator}
            />
          )}
        </Pressable>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Pressable
              disabled={isMessageBeingSent}
              style={styles.addButton}
              onPress={setShowAddMedia.bind(this, !showAddMedia)}
            >
              {isAssetProcessing ? (
                <ActivityIndicator size={'small'} color={colors.white} />
              ) : (
                <Image
                  source={require('./assets/add.png')}
                  style={styles.send}
                  tintColor={colors.white}
                />
              )}
            </Pressable>
            {showAddMedia && (
              <View style={styles.addMediaContainer}>
                <Pressable onPress={openGallery} style={styles.addMediaButton}>
                  <Image
                    source={require('./assets/gallery.png')}
                    style={styles.send}
                    tintColor={colors.white}
                  />
                  <Text style={styles.addMediaText}>Photos & Videos</Text>
                </Pressable>
                <Pressable
                  style={styles.addMediaButton}
                  onPress={openCamera.bind(this, 'back')}
                >
                  <Image
                    source={require('./assets/camera.png')}
                    style={styles.send}
                    tintColor={colors.white}
                  />
                  <Text style={styles.addMediaText}>Open Camera</Text>
                </Pressable>
              </View>
            )}
            <TextInput
              value={text}
              autoFocus={autoFocus}
              multiline={true}
              style={[
                styles.textInput,
                isMessageBeingSent ? { color: colors.darkGray } : {},
              ]}
              onChangeText={onChangeText}
              placeholder={'Message'}
              placeholderTextColor={colors.darkGray}
            />
            <Pressable onPress={onSend} style={styles.sendButton}>
              {isMessageBeingSent ? (
                <ActivityIndicator size={'small'} color={colors.white} />
              ) : (
                <Image
                  source={require('./assets/send.png')}
                  style={styles.send}
                  tintColor={colors.white}
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export { UserTextInput };

const handleUrlPreviewWithDebounce = _.debounce(
  ({ text, urlToPreview, setUrlToPreview, setIsLoadingUrlPreview }) => {
    const urlsToProcess: string[] = text.match(
      /\b(?:https?|ftp):\/\/[^\s\/$.?#].[^\s]*\b/g
    );
    if (
      !_.isEmpty(urlsToProcess) &&
      urlsToProcess?.[0] !==
        urlToPreview?.originalUrl /** limiting to 1 url for now */
    ) {
      setIsLoadingUrlPreview(true);
      fetchUrlsToPreview([urlsToProcess[0]])
        .then((response) => {
          setUrlToPreview({
            ...response?.[0]?.value,
            originalUrl: urlsToProcess?.[0],
          });
        })
        .catch(() => {
          setUrlToPreview(undefined);
        })
        .finally(setIsLoadingUrlPreview.bind(this, false));
    } else if (_.isEmpty(urlsToProcess)) {
      setUrlToPreview(undefined);
    }
  },
  1000
);

export default UserTextInput;

const styles = StyleSheet.create({
  assetPreviewImage: {
    height: 120,
    width: 120,
    borderRadius: 8,
  },
  container: {
    backgroundColor: 'transparent',
  },
  mediaScrollView: {
    backgroundColor: colors.paleGray,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
  },
  mediaScrollViewContentContainer: {
    paddingVertical: 8,
    paddingLeft: 24,
  },
  mediaItemContainer: {
    marginRight: 16,
    marginVertical: 8,
  },
  deleteButton: {
    position: 'absolute',
    right: -8,
    top: -8,
    borderRadius: 100,
    height: 24,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.softRed,
    transform: [{ rotate: '45deg' }],
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  inputContainer: {
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.paleGray,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.white,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    marginHorizontal: 16,
    paddingTop: IS_IOS ? 12 : 0,
    paddingBottom: IS_IOS ? 14 : 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    maxHeight: 120,
    height: '100%',
  },
  addButton: {
    backgroundColor: colors.darkMint,
    height: 40,
    width: 40,
    borderRadius: 120,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  addMediaContainer: {
    backgroundColor: colors.darkMint,
    position: 'absolute',
    bottom: 46,
    left: 0,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'space-between',
    rowGap: 16,
  },
  addMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMediaText: { color: colors.white, marginLeft: 8, fontWeight: '600' },
  sendButton: {
    backgroundColor: colors.darkMint,
    height: 40,
    width: 40,
    borderRadius: 120,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  send: {
    height: 24,
    width: 24,
  },
  urlPreviewContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
    borderTopWidth: 1,
    borderTopColor: colors.softGray,
    alignItems: 'center',
  },
  urlPreviewImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 16,
  },
  urlPreviewImage: {
    height: 50,
    width: 50,
    borderRadius: 12,
  },
  urlPreviewTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  urlPreviewTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  urlPreviewActivityIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#00000080',
  },
});
