import _ from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Userpic } from 'react-native-userpic';
import { Channel, NexChat } from '@nexchat/client-js';
import { colors } from './colors';
import { socketConnectionCheck } from './utils';

export const ChannelList = ({
  client,
  onPressChannel,
  flatListStyle,
  messageTextStyle,
}: {
  client: NexChat;
  onPressChannel?: (channel: Channel) => void;
  flatListStyle?: StyleProp<ViewStyle>;
  messageTextStyle?: StyleProp<TextStyle>;
}) => {
  const pageNumberRef = useRef(0);
  const isLastPageRef = useRef(false);

  const [isFetchingNextChannels, setIsFetchingNextChannels] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [refreshList, setRefreshList] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    socketConnectionCheck(client);
  }, []);

  useEffect(() => {
    getUserChannels({ pageNumber: 0 });

    const removeMessageListener = client.on('message.new', () => {
      setRefreshList((prev) => !prev);
      // Sort channels based on last activity time
      setChannels((prevChannels) => {
        return _.sortBy(prevChannels, ['lastActivityAt']).reverse();
      });
    });
    const removeNewChannelListener = client.on('channel.created', (channel) => {
      client.getChannelByIdAsync(channel.channelId).then((newChannel) => {
        setChannels((prevChannels) => {
          let newChannels = [...prevChannels];
          newChannels.unshift(newChannel);
          newChannels = _.uniqBy(newChannels, 'channelId');
          return _.sortBy(newChannels, ['lastActivityAt']).reverse();
        });
      });
    });
    return () => {
      removeMessageListener();
      removeNewChannelListener();
    };
  }, []);

  const getUserChannels = ({ pageNumber }: { pageNumber: number }) => {
    if (isFetchingNextChannels) return;
    setIsFetchingNextChannels(true);

    const pageSize = 20;
    client
      .getUserChannelsAsync({
        limit: pageSize,
        offset: pageNumber * pageSize,
      })
      .then((data) => {
        if (pageNumber === 0) {
          setChannels(data.channels);
          pageNumberRef.current = 0;
        } else {
          setChannels((prevChannels) => [...prevChannels, ...data.channels]);
        }
        isLastPageRef.current = data.isLastPage;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setIsFetchingNextChannels(false);
        setIsLoading(false);
        setTimeout(() => {
          setIsRefreshing(false);
        }, 250);
      });
  };

  const onEndReached = () => {
    if (!isLoading && !isLastPageRef.current) {
      pageNumberRef.current++;
      getUserChannels({ pageNumber: pageNumberRef.current });
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    getUserChannels({ pageNumber: 0 });
    socketConnectionCheck(client);
  }, []);

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
    <FlatList
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.darkMint}
        />
      }
      data={channels}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      keyExtractor={(item) => item.channelId}
      contentContainerStyle={[styles.contentContainer, flatListStyle]}
      renderItem={({ item }) => (
        <ChannelItem
          channel={item}
          onPressChannel={onPressChannel}
          messageTextStyle={messageTextStyle}
        />
      )}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: colors.lightGray }} />
      )}
      extraData={refreshList}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Text>No chats yet</Text>
        </View>
      }
      ListFooterComponent={
        <ActivityIndicator
          size={'small'}
          animating={isFetchingNextChannels}
          color={colors.darkMint}
          style={{ paddingVertical: 20 }}
        />
      }
    />
  );
};

const ChannelItem = ({
  channel,
  onPressChannel,
  messageTextStyle,
}: {
  channel: Channel;
  onPressChannel?: (channel: Channel) => void;
  messageTextStyle?: StyleProp<TextStyle>;
}) => {
  const [unreadCount, setUnreadCount] = useState(channel.unreadCount);

  const displayDetails = channel.getDisplayDetails();

  useEffect(() => {
    const removeChannelUpdateListner = channel.on(
      'channel.updateUnReadCount',
      (channelUpdateData) => {
        setUnreadCount(channelUpdateData.unreadCount ?? 0);
      }
    );

    return () => {
      removeChannelUpdateListner();
    };
  }, []);

  const convertTimeStamp = (timeStamp?: string) => {
    if (!timeStamp) {
      return '';
    }

    const date = new Date(timeStamp);
    const today = new Date();
    if (date.getDate() === today.getDate()) {
      return date.toLocaleTimeString(undefined, {
        timeStyle: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (date.getDate() === today.getDate() - 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.item} onPress={() => onPressChannel?.(channel)}>
        <Userpic
          source={
            displayDetails.imageUrl
              ? { uri: displayDetails.imageUrl }
              : undefined
          }
          name={displayDetails.name}
          color={colors.darkMint}
        />

        <View style={styles.msgContainer}>
          <View style={styles.userNameTimeContainer}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.displayName}
            >
              {displayDetails.name}
            </Text>
            <Text style={styles.timeText}>
              {convertTimeStamp(channel.lastMessage?.createdAt)}
            </Text>
          </View>
          <View style={styles.userNameTimeContainer}>
            <Text
              style={[styles.messageText, messageTextStyle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {channel?.lastMessage?.attachments?.[0]
                ? '📎 Attachment'
                : channel?.lastMessage?.text ?? 'Start a conversation 💬'}
            </Text>
            {unreadCount ? (
              <View style={styles.unreadCountContainer}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  activityIndicator: { marginTop: 20 },
  contentContainer: {},
  unreadCountText: {
    color: colors.white,
    fontSize: 12,
  },
  unreadCountContainer: {
    backgroundColor: colors.darkMint,
    borderRadius: 20,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressable: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center' },
  profileImage: {
    height: 40,
    width: 40,
    borderRadius: 40,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgContainer: { marginLeft: 16, flex: 1 },
  userNameTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  messageText: {
    fontWeight: '400',
    fontSize: 16,
    color: colors.grayMediumLight,
    maxWidth: '90%',
  },
  displayName: { fontWeight: '600', fontSize: 18, flex: 1, paddingRight: 12 },
  timeText: { fontSize: 12, color: colors.grayMediumLight },
  emptyList: {
    marginTop: 20,
    alignItems: 'center',
  },
});
