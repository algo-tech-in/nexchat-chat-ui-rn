import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors } from "./colors";
import {
  Asset,
  CameraType,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from "react-native-image-picker";
import _ from "lodash";
import { Image as ImageCompress, UploadType } from "react-native-compressor";
import { backgroundUpload } from "react-native-compressor";
import { IMAGE_COMPRESS_CONFIG } from "./constants";
import { NexChat, Message } from "@nexchat/chat-js";
import { SendMessageProps } from "./types";

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
  const [text, setText] = useState("");

  const onChangeText = (inputText: string) => {
    setText(inputText);
  };

  const onSend = async () => {
    setSendingMessage(true);
    if (_.isFunction(onPressSend)) {
      let uploadResponse = undefined;
      if (!_.isEmpty(localMediaList)) {
        uploadResponse = await uploadSelectedMedia();
      }
      onPressSend({ text, attachments: uploadResponse })
        .then(() => {
          setText("");
          setLocalMediaList([]);
        })
        .finally(() => {
          setSendingMessage(false);
        });
    }
  };

  const [showAddMedia, setShowAddMedia] = useState(false);
  const [localMediaList, setLocalMediaList] = useState<Asset[]>([]);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);

  const openCamera = async (cameraType: CameraType) => {
    const mediaResponse = await launchCamera({
      mediaType: "photo",
      quality: 0.8,
      cameraType: cameraType,
    });
    setShowAddMedia(false);
    updateSelectedMediaList(mediaResponse);
  };

  const openPhotoGallery = async () => {
    const mediaResponse = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.8,
      selectionLimit: 0,
    });
    setShowAddMedia(false);
    updateSelectedMediaList(mediaResponse);
  };

  const updateSelectedMediaList = (mediaResponse: ImagePickerResponse) => {
    mediaResponse.assets?.forEach((asset) => {
      if (asset.uri) {
        setLocalMediaList((oldList) => [...oldList, asset]);
      }
    });
  };

  const uploadSelectedMedia = async () => {
    const metadata = _.map(localMediaList, (mediaItem) => {
      return {
        mimeType: mediaItem?.type || "UNK",
        fileUri: mediaItem?.uri || "UNK",
      };
    });

    const signedUrlList = await client.createUploadUrlsAsync({ metadata });

    const uploadPromises = _.map(signedUrlList, async (signedUrl, index) => {
      const compressedUri = await ImageCompress.compress(
        signedUrl.uri,
        IMAGE_COMPRESS_CONFIG
      );
      await backgroundUpload(signedUrl.url, compressedUri, {
        uploadType: UploadType.BINARY_CONTENT, // TODO: Change to MULTIPART
        // fieldName: signedUrl.fileId, TODO: ADD WITH MULTIPART
        mimeType: signedUrl.mimeType,
        httpMethod: "PUT",
        headers: {
          "Content-Type": signedUrl.mimeType,
        },
      });
    });

    await Promise.all(uploadPromises);

    return signedUrlList;
  };

  return (
    <KeyboardAvoidingView
      enabled={Platform.OS === "ios"}
      behavior="padding"
      keyboardVerticalOffset={100}
    >
      <View style={styles.container}>
        {!_.isEmpty(localMediaList) && (
          <ScrollView
            showsHorizontalScrollIndicator={false}
            contentInset={{ left: 0, right: 24 }}
            horizontal={true}
            contentContainerStyle={{
              paddingRight: 28,
            }}
            style={styles.mediaScrollView}
          >
            {_.map(localMediaList, (mediaItem, index) => {
              return (
                <View
                  key={`${mediaItem.uri}-${index}`}
                  style={styles.mediaItemContainer}
                >
                  <Image
                    source={{ uri: mediaItem.uri }}
                    style={styles.mediaItem}
                  />
                  <Pressable
                    onPress={() => {
                      const newLocalMediaList = [...localMediaList];
                      newLocalMediaList.splice(index, 1);
                      setLocalMediaList(newLocalMediaList);
                    }}
                    style={[
                      styles.deleteButton,
                      { display: sendingMessage ? "none" : "flex" },
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>+</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Pressable
              disabled={sendingMessage}
              style={styles.addButton}
              onPress={setShowAddMedia.bind(this, !showAddMedia)}
            >
              <Image
                source={require("./assets/add.png")}
                style={styles.send}
                tintColor={colors.white}
              />
            </Pressable>
            {showAddMedia && (
              <View style={styles.addMediaContainer}>
                <Pressable
                  onPress={openPhotoGallery}
                  style={styles.addMediaButton}
                >
                  <Image
                    source={require("./assets/gallery.png")}
                    style={styles.send}
                    tintColor={colors.white}
                  />
                </Pressable>
                <Pressable
                  style={styles.addMediaButton}
                  onPress={openCamera.bind(this, "back")}
                >
                  <Image
                    source={require("./assets/camera.png")}
                    style={styles.send}
                    tintColor={colors.white}
                  />
                </Pressable>
              </View>
            )}
            <View style={styles.inputContainerBox}>
              <TextInput
                value={text}
                {...{
                  autoFocus: autoFocus,
                  multiline: true,
                  style: styles.textInput,
                  onChangeText: onChangeText,
                  placeholder: "Message",
                  editable: !isLoading && !sendingMessage,
                }}
                placeholderTextColor={colors.darkGray}
              />
            </View>
            <Pressable onPress={onSend} style={styles.sendButton}>
              {sendingMessage ? (
                <ActivityIndicator size={"small"} color={colors.white} />
              ) : (
                <Image
                  source={require("./assets/send.png")}
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  mediaScrollView: {
    backgroundColor: colors.paleGray,
    width: "100%",
    paddingVertical: 8,
    paddingLeft: 24,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
  },
  mediaItemContainer: {
    marginRight: 16,
    marginVertical: 8,
  },
  mediaItem: {
    height: 120,
    aspectRatio: 1,
    borderRadius: 8,
  },
  deleteButton: {
    position: "absolute",
    right: -8,
    top: -8,
    borderRadius: 100,
    height: 24,
    width: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.softRed,
    transform: [{ rotate: "45deg" }],
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
    fontWeight: "600",
    fontSize: 16,
  },
  inputContainer: {
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.paleGray,
    paddingTop: 8,
    backgroundColor: colors.white,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
  },
  inputContainerBox: {
    flex: 1,
  },
  textInput: {
    flex: 1,
    marginHorizontal: 16,
    minHeight: 48,
    paddingTop: Platform.OS === "ios" ? 14 : 0,
    paddingBottom: Platform.OS === "ios" ? 14 : 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: colors.darkMint,
    height: 40,
    width: 40,
    borderRadius: 120,
    justifyContent: "center",
    alignItems: "center",
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
    position: "absolute",
    top: -112,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 32,
    height: 100,
    justifyContent: "space-between",
  },
  addMediaButton: {
    padding: 8,
    borderRadius: 100,
  },
  sendButton: {
    backgroundColor: colors.darkMint,
    height: 40,
    width: 40,
    borderRadius: 120,
    justifyContent: "center",
    alignItems: "center",
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
  mediaIconContainer: {
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 100,
  },
});
