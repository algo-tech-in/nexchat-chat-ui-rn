import { Channel, Message, NexChat } from "@nexchat/chat-js";
import _ from "lodash";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageProps,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ImageViewing from "react-native-image-viewing";
import { SendMessageProps } from "./types";
import { UserTextInput } from "./UserTextInput";
import { isSameDate } from "./utils";
import { colors } from "./colors";
import { Userpic } from "react-native-userpic";

type ChannelMessagesProps = {
  client: NexChat;
  channelId: string;
  onBackPress?: () => void;
  showHeader?: boolean;
};

type MediaHandlerProps = {
  imageList: Array<{ url: string }>;
};

type MessageBubbleProps = {
  isSendedByUser: boolean;
  text: string;
  createdAt: string;
  attachments: Array<{ url: string }>;
};

const ItemSeparatorComponent = () => <View style={styles.itemSeparator} />;

const ChannelMessages: React.FC<ChannelMessagesProps> = ({
  client,
  channelId,
  onBackPress,
  showHeader = true,
}) => {
  const channelRef = useRef<Channel | undefined>(undefined);
  const isLastPageRef = useRef(false);
  const isFetchingNextMessagesRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOtherUser, setIsBlockedByOtherUser] = useState(false);

  const displayDetails = channelRef.current?.getDisplayDetails?.();

  useEffect(() => {
    setIsLoading(true);
    client.getChannelByIdAsync(channelId).then((newChannel: Channel) => {
      channelRef.current = newChannel;
      setIsLoading(false);
      setIsBlocked(channelRef.current.isBlocked);
      setIsBlockedByOtherUser(channelRef.current.isOtherUserBlocked);
      channelRef.current.markChannelRead();
    });
  }, [channelId]);

  useEffect(() => {
    if (!channelRef.current?.channelId) {
      return;
    }

    const removeListener = channelRef.current.on(
      "message.new",
      (message: Message) => {
        channelRef.current?.markChannelRead();
        setMessages((prevMessages) => [message, ...prevMessages]);
      }
    );

    const removeUpdateListener = channelRef.current.on("channel.update", () => {
      setIsBlocked(channelRef.current?.isBlocked ?? false);
      setIsBlockedByOtherUser(channelRef.current?.isOtherUserBlocked ?? false);
    });

    setIsLoading(true);
    channelRef.current
      .getChannelMessagesAsync({
        limit: 20,
      })
      .then((data) => {
        setMessages(data.messages);
        isLastPageRef.current = data.isLastPage;
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      removeListener();
      removeUpdateListener();
    };
  }, [channelRef.current?.channelId]);

  const onEndReached = () => {
    if (!isLoading && !isLastPageRef.current) {
      getMessages(messages[messages?.length - 1]?.createdAt);
    }
  };

  const getMessages = (lastMessageCreatedAt?: string) => {
    if (!channelRef.current?.channelId || isFetchingNextMessagesRef.current) {
      return;
    }
    isFetchingNextMessagesRef.current = true;
    channelRef.current
      .getChannelMessagesAsync({
        limit: 20,
        lastCreatedAt: lastMessageCreatedAt,
      })
      .then((data) => {
        setMessages((prevMessages) => [...prevMessages, ...data.messages]);
        isLastPageRef.current = data.isLastPage;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        isFetchingNextMessagesRef.current = false;
      });
  };

  const sendMessageAsync = (props: SendMessageProps): Promise<Message> => {
    const { text, urlPreview, attachments } = props;
    const trimmedText = _.isEmpty(text) ? undefined : text?.trim?.();
    return new Promise((resolve, reject) => {
      if (_.isEmpty(attachments) && _.isUndefined(trimmedText)) {
        reject("Message is empty");
      } else if (channelRef?.current) {
        channelRef?.current
          .sendMessageAsync({
            text: trimmedText,
            urlPreview: urlPreview,
            attachments: attachments,
          })
          .then((res) => {
            resolve(res);
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        reject("Channel is not available");
      }
    });
  };

  if (isLoading) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.darkMint}
        style={styles.activityIndicator}
      />
    );
  }

  return (
    <View style={styles.container}>
      {showHeader ? (
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={onBackPress} activeOpacity={0.8}>
            <Image
              source={require("./assets/back.png")}
              style={styles.back}
              tintColor={colors.black}
            />
          </TouchableOpacity>
          <Userpic
            size={40}
            source={
              displayDetails?.imageUrl
                ? { uri: displayDetails.imageUrl }
                : undefined
            }
            name={displayDetails?.name}
            color={colors.darkMint}
          />
          <Text style={styles.headerTitle}>{displayDetails?.name}</Text>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={styles.flatListContainer}
        data={messages}
        inverted={true}
        keyExtractor={(item) => item.messageId}
        ItemSeparatorComponent={ItemSeparatorComponent}
        renderItem={({ item, index }) => {
          const isSendedByUser =
            item.user.externalUserId === client.externalUserId;
          const showDate = messages?.[index + 1]
            ? !isSameDate(item.createdAt, messages[index + 1].createdAt)
            : true;
          return (
            <View>
              {showDate && (
                <View style={styles.dateContainer}>
                  <Text style={styles.dateContent}>
                    {new Date(item.createdAt).toDateString()}
                  </Text>
                </View>
              )}
              <MessageBubble
                isSendedByUser={isSendedByUser}
                text={item.text}
                createdAt={item.createdAt}
                attachments={item.attachments}
              />
            </View>
          );
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
      {isBlocked || isBlockedByOtherUser ? (
        <View style={styles.blockedContainer}>
          <Text>You can no longer send messages</Text>
        </View>
      ) : (
        <UserTextInput client={client} onPressSend={sendMessageAsync} />
      )}
    </View>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  isSendedByUser,
  text,
  createdAt,
  attachments,
}) => {
  return (
    <View
      style={[
        styles.messageContainer,
        isSendedByUser && styles.messageContainerUser,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isSendedByUser && styles.messageBubbleUser,
        ]}
      >
        {!_.isEmpty(attachments) && <MediaHandler imageList={attachments} />}
        {!_.isEmpty(text) && <Text style={styles.msgText}>{text}</Text>}
        <Text style={styles.msgTimeText}>
          {new Date(createdAt).toLocaleTimeString(undefined, {
            timeStyle: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
};

const MediaHandler: React.FC<MediaHandlerProps> = ({ imageList }) => {
  const imageCount = imageList.length;
  const [openViewerWithIndex, setOpenViewerWithIndex] = useState<null | number>(
    null
  );
  const imageUrlList = imageList.map((item) => ({ uri: item.url }));
  return (
    <View style={{ marginBottom: 8 }}>
      {imageCount === 1 ? (
        <ImageWithLoader
          style={styles.image}
          resizeMode="cover"
          source={{
            uri: imageList[0].url,
          }}
          onPress={setOpenViewerWithIndex.bind(this, 0)}
        />
      ) : (
        <View style={styles.imageContainer}>
          <ImageWithLoader
            style={styles.imageWrapper}
            resizeMode="cover"
            source={{
              uri: imageList[0].url,
            }}
            onPress={setOpenViewerWithIndex.bind(this, 0)}
          />
          <ImageWithLoader
            style={styles.imageWrapper}
            resizeMode="cover"
            source={{
              uri: imageList[1].url,
            }}
            onPress={setOpenViewerWithIndex.bind(this, 1)}
          />
        </View>
      )}
      {imageCount > 2 && (
        <View style={styles.imageContainer}>
          <ImageWithLoader
            style={styles.imageWrapper}
            resizeMode="cover"
            source={{
              uri: imageList[2].url,
            }}
            onPress={setOpenViewerWithIndex.bind(this, 2)}
          />
          {imageCount >= 4 && (
            <View style={styles.imageWrapperOverflow}>
              <ImageWithLoader
                style={styles.imageOverflow}
                resizeMode="cover"
                source={{
                  uri: imageList[3].url,
                }}
              />
              {imageCount > 4 && (
                <Pressable
                  style={styles.imageCountOverlay}
                  onPress={setOpenViewerWithIndex.bind(this, 3)}
                >
                  <Text style={styles.countText}>{`+${imageCount - 3}`}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {!_.isNull(openViewerWithIndex) && (
        <ImageViewing
          images={imageUrlList}
          imageIndex={openViewerWithIndex}
          visible={true}
          onRequestClose={setOpenViewerWithIndex.bind(this, null)}
        />
      )}
    </View>
  );
};

const ImageWithLoader = (props: ImageProps & { onPress?: () => void }) => {
  const [isLoading, setIsLoading] = useState(true);
  return (
    <TouchableWithoutFeedback
      onPress={_.isFunction(props.onPress) ? props.onPress : undefined}
    >
      <Image
        onLoadEnd={setIsLoading.bind(this, false)}
        {...props}
        style={[props.style, isLoading && styles.imageLoading]}
      />
    </TouchableWithoutFeedback>
  );
};

export { ChannelMessages };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  itemSeparator: {
    height: 12,
  },
  messageContainer: {
    alignItems: "flex-start",
    paddingHorizontal: 12,
    marginRight: "10%",
  },
  messageContainerUser: {
    alignItems: "flex-end",
    marginRight: "0%",
    marginLeft: "10%",
  },
  messageBubble: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    marginTop: 2,
  },
  messageBubbleUser: {
    backgroundColor: colors.lightMint,
  },
  activityIndicator: { flex: 1 },
  msgText: { paddingRight: 16, color: colors.black },
  msgTimeText: {
    alignSelf: "flex-end",
    fontSize: 10,
    color: colors.darkGray,
    marginTop: 4,
  },
  dateContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
  dateContent: {
    backgroundColor: "#ffffff80",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    color: colors.darkGray,
  },
  flatListContainer: { paddingVertical: 18 },
  blockedContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: colors.softGray,
  },
  countText: {
    color: colors.white,
    fontSize: 24,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  imageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  imageWrapper: {
    width: "49%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  imageWrapperOverflow: {
    width: "49%",
    borderRadius: 12,
    overflow: "hidden",
  },
  imageOverflow: {
    width: "100%",
    aspectRatio: 1,
  },
  imageCountOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.5)",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageLoading: {
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.white,
  },
  back: {
    height: 24,
    width: 24,
    marginRight: 4,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  headerTitle: {
    color: colors.black,
    marginLeft: 12,
    fontWeight: "600",
    fontSize: 16,
  },
});
