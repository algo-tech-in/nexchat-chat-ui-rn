import { Channel, Message, NexChat } from '@nexchat/client-js';
import { MenuView, NativeActionEvent } from '@react-native-menu/menu';
import { SendMessageProps } from 'client-js/src/types';
import _ from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Hyperlink from 'react-native-hyperlink';
import { Userpic } from 'react-native-userpic';
import { colors } from './colors';
import { AssetPreview } from './components/AssetPreview';
import { AssetsCarousel } from './components/AssetsCarousel';
import { Attachment, FulfilledLinkPreview } from './types';
import { UserTextInput } from './UserTextInput';
import { isSameDate, socketConnectionCheck } from './utils';

type ChannelMessagesProps = {
  client: NexChat;
  channelId: string;
  onBackPress?: () => void;
  showHeader?: boolean;
  onHeaderProfilePress?: () => void;
  onBlockPress?: () => void;
  onUnblockPress?: () => void;
};

type MediaHandlerProps = {
  imageList: Attachment[];
};

type MessageBubbleProps = {
  isSendedByUser: boolean;
  text: string;
  createdAt: string;
  attachments: Attachment[];
  urls: FulfilledLinkPreview[];
};

const ItemSeparatorComponent = () => <View style={styles.itemSeparator} />;

const ChannelMessages: React.FC<ChannelMessagesProps> = ({
  client,
  channelId,
  onBackPress,
  showHeader = true,
  onHeaderProfilePress,
  onBlockPress: onBlockPressCallback,
  onUnblockPress: onUnblockPressCallback,
}) => {
  const isLastPageRef = useRef(false);
  const isFetchingNextMessagesRef = useRef(false);

  const [channel, setChannel] = useState<Channel | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOtherUser, setIsBlockedByOtherUser] = useState(false);

  const displayDetails = channel?.getDisplayDetails?.();

  useEffect(() => {
    socketConnectionCheck(client);
  }, []);

  useEffect(() => {
    client.getChannelByIdAsync(channelId).then((newChannel: Channel) => {
      setChannel(newChannel);
      setIsBlocked(newChannel.isBlocked);
      setIsBlockedByOtherUser(newChannel.isOtherUserBlocked);
      newChannel.markChannelRead();
    });
  }, [channelId]);

  useEffect(() => {
    if (!channel?.channelId) {
      return;
    }

    const removeListener = channel.on('message.new', (message: Message) => {
      channel?.markChannelRead();
      onNewMessage(message);
    });

    const removeUpdateListener = channel.on('channel.update', () => {
      setIsBlocked(channel?.isBlocked ?? false);
      setIsBlockedByOtherUser(channel?.isOtherUserBlocked ?? false);
    });

    channel
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
  }, [channel?.channelId]);

  const onNewMessage = (message: Message) => {
    setMessages((prevMessages) => {
      if (!_.find(prevMessages, { messageId: message.messageId })) {
        return [message, ...prevMessages];
      }
      return prevMessages;
    });
  };

  const onEndReached = () => {
    if (!isLoading && !isLastPageRef.current) {
      getMessages(messages[messages?.length - 1]?.createdAt);
    }
  };

  const getMessages = (lastMessageCreatedAt?: string) => {
    if (!channel?.channelId || isFetchingNextMessagesRef.current) {
      return;
    }
    isFetchingNextMessagesRef.current = true;
    channel
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
        reject('Message is empty');
      }
      channel!
        .sendMessageAsync({
          text: trimmedText,
          urlPreview: urlPreview,
          attachments: attachments,
        })
        .then((message) => {
          onNewMessage(message);
          resolve(message);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const onBlockPress = () => {
    setIsLoading(true);
    onBlockPressCallback?.();
    channel!
      .blockChannelAsync()
      .then(() => {
        setIsBlocked(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const onUnblockPress = () => {
    setIsLoading(true);
    onUnblockPressCallback?.();
    channel!
      .unBlockChannelAsync()
      .then(() => {
        setIsBlocked(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const onClearChatPress = () => {};

  const onPressMenuItem = ({ nativeEvent }: NativeActionEvent) => {
    if (!channel || !displayDetails) {
      return;
    }
    switch (nativeEvent.event) {
      case 'block':
        Alert.alert(
          `Are you sure you want to block ${displayDetails.name}?`,
          'You can no longer send or receive any messages. You can unblock anytime.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Block & Report',
              onPress: onBlockPress,
              style: 'destructive',
            },
          ]
        );
        break;
      case 'unblock':
        Alert.alert(
          `Are you sure you want to unblock ${displayDetails.name}?`,
          'You can again send and receive messages.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            { text: 'Unblock', onPress: onUnblockPress },
          ]
        );
        break;

      case 'clear':
        Alert.alert(
          `Are you sure you want to clear this chat?`,
          'All messages will be cleared. You can still send and receive new messages.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            { text: 'Clear', onPress: onClearChatPress, style: 'destructive' },
          ]
        );
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.headerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={onBackPress}
              activeOpacity={0.8}
              hitSlop={8}
            >
              <Image
                source={require('./assets/back.png')}
                style={styles.back}
                tintColor={colors.black}
                resizeMode="stretch"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onHeaderProfilePress}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
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
            </TouchableOpacity>
          </View>
          {isBlockedByOtherUser ? null : (
            <View>
              <MenuView
                onPressAction={onPressMenuItem}
                actions={[
                  // { id: "clear", title: "Clear Chat" },
                  isBlocked
                    ? {
                        id: 'unblock',
                        title: 'Unblock',
                      }
                    : {
                        id: 'block',
                        title: 'Block & Report',
                      },
                ]}
              >
                <Image
                  source={require('./assets/more.png')}
                  style={styles.more}
                  tintColor={colors.black}
                />
              </MenuView>
            </View>
          )}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <FlatList
          contentContainerStyle={styles.flatListContainer}
          data={messages}
          extraData={isLoading}
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
                  urls={item.urlPreview}
                />
              </View>
            );
          }}
          ListHeaderComponent={() => {
            if (isLoading || messages.length !== 0) {
              return null;
            }
            return (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text>No messages yet</Text>
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
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.darkMint}
              style={styles.activityIndicator}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  isSendedByUser,
  text,
  createdAt,
  attachments,
  urls,
}) => {
  const [showUrlImage, setShowUrlImage] = useState(true);
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
        {!_.isNil(urls?.[0]?.url) && (
          <Pressable
            style={{
              backgroundColor: colors.white,
              padding: 8,
              borderRadius: 4,
              marginBottom: 8,
              flexDirection: 'row',
            }}
            onPress={() => {
              Linking.openURL(urls?.[0]?.originalUrl).catch(() => {});
            }}
          >
            {showUrlImage && !_.isEmpty(urls?.[0]?.images?.[0]) && (
              <Image
                source={{ uri: urls?.[0]?.images?.[0] }}
                style={{ height: 40, width: 40, marginRight: 16 }}
                resizeMode="contain"
                onError={setShowUrlImage.bind(this, false)}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontWeight: 600, fontSize: 16, flex: 1 }}
                numberOfLines={2}
              >
                {urls?.[0]?.title}
              </Text>
              {!_.isEmpty(urls?.[0]?.description) && (
                <Text numberOfLines={2} style={{ flex: 1 }}>
                  {urls?.[0]?.description}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        {!_.isEmpty(text) && (
          <Hyperlink
            onPress={(url) => {
              Linking.openURL(url).catch(() => {});
            }}
            linkStyle={{
              color: colors.link,
            }}
          >
            <Text style={styles.msgText}>{text}</Text>
          </Hyperlink>
        )}
        <Text style={styles.msgTimeText}>
          {new Date(createdAt).toLocaleTimeString(undefined, {
            timeStyle: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
};

const MediaHandler: React.FC<MediaHandlerProps> = ({ imageList }) => {
  const imageCount = imageList.length;
  const [openViewerWithIndex, setOpenViewerWithIndex] = useState<
    number | undefined
  >();
  return (
    <View style={{ marginBottom: 8 }}>
      {imageCount === 1 ? (
        <AssetPreview
          url={imageList[0].url}
          mimeType={imageList[0].mimeType}
          imageProps={{
            style: styles.image,
            resizeMode: 'cover',
          }}
          onPress={() => setOpenViewerWithIndex(0)}
        />
      ) : (
        <View style={styles.imageContainer}>
          <AssetPreview
            url={imageList[0].url}
            mimeType={imageList[0].mimeType}
            imageProps={{
              style: [styles.imageWrapper, { marginRight: 6 }],
              resizeMode: 'cover',
            }}
            containerStyle={{ width: '49%' }}
            onPress={() => setOpenViewerWithIndex(0)}
          />
          <AssetPreview
            url={imageList[1].url}
            mimeType={imageList[1].mimeType}
            imageProps={{
              style: styles.imageWrapper,
              resizeMode: 'cover',
            }}
            containerStyle={{ width: '49%' }}
            onPress={() => setOpenViewerWithIndex(1)}
          />
        </View>
      )}
      {imageCount > 2 && (
        <View style={styles.imageContainer}>
          <AssetPreview
            url={imageList[2].url}
            mimeType={imageList[2].mimeType}
            imageProps={{
              style: styles.imageWrapper,
              resizeMode: 'cover',
            }}
            containerStyle={{ width: '49%' }}
            onPress={() => setOpenViewerWithIndex(2)}
          />
          {imageCount >= 4 && (
            <View style={styles.imageWrapperOverflow}>
              <AssetPreview
                url={imageList[3].url}
                mimeType={imageList[3].mimeType}
                imageProps={{
                  style: styles.imageOverflow,
                  resizeMode: 'cover',
                }}
                containerStyle={{ width: '100%' }}
                onPress={() => setOpenViewerWithIndex(3)}
              />
              {imageCount > 4 && (
                <Pressable
                  style={styles.imageCountOverlay}
                  onPress={() => setOpenViewerWithIndex(3)}
                >
                  <Text style={styles.countText}>{`+${imageCount - 3}`}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
      {_.isNil(openViewerWithIndex) ? null : (
        <AssetsCarousel
          assets={imageList}
          visible={_.isNumber(openViewerWithIndex)}
          onClose={() => setOpenViewerWithIndex(undefined)}
          initialIndex={openViewerWithIndex}
        />
      )}
    </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    marginRight: '10%',
  },
  messageContainerUser: {
    alignItems: 'flex-end',
    marginRight: '0%',
    marginLeft: '10%',
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
  activityIndicator: {},
  msgText: { paddingRight: 16, color: colors.black },
  msgTimeText: {
    alignSelf: 'flex-end',
    fontSize: 10,
    color: colors.darkGray,
    marginTop: 4,
  },
  dateContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dateContent: {
    backgroundColor: '#ffffff80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.darkGray,
  },
  flatListContainer: { paddingVertical: 18 },
  blockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: colors.softGray,
  },
  countText: {
    color: colors.white,
    fontSize: 24,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  imageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  imageWrapperOverflow: {
    width: '49%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageOverflow: {
    width: '100%',
    aspectRatio: 1,
  },
  imageCountOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoading: {
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.white,
  },
  back: {
    height: 20,
    width: 20,
    marginRight: 8,
  },
  more: {
    height: 18,
    width: 18,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    position: 'absolute',
    flex: 1,
    height: '105%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
