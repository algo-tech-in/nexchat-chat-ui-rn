import _ from "lodash";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Userpic } from "react-native-userpic";
import { Channel, NexChat } from "@nexchat/chat-js";
import { colors } from "./colors";

export const ChannelList = ({
  client,
  onPressChannel,
}: {
  client: NexChat;
  onPressChannel?: (channel: Channel) => void;
}) => {
  const pageNumberRef = useRef(0);
  const isLastPageRef = useRef(false);
  const isFetchingNextChannelsRef = useRef(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [refreshList, setRefreshList] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUserChannels({ pageNumber: 0 });

    const removeMessageListener = client.on("message.new", () => {
      setRefreshList((prev) => !prev);
      // Sort channels based on last message time
      setChannels((prevChannels) => {
        const newChannels = [...prevChannels];

        newChannels.sort((a, b) => {
          return (
            new Date(b.lastMessage?.createdAt ?? "").getTime() -
            new Date(a.lastMessage?.createdAt ?? "").getTime()
          );
        });
        return newChannels;
      });
    });
    const removeNewChannelListener = client.on("channel.created", (channel) => {
      client.getChannelByIdAsync(channel.channelId).then((newChannel) => {
        setChannels((prevChannels) => {
          const newChannels = [...prevChannels];
          newChannels.unshift(newChannel);
          return _.uniqBy(newChannels, "channelId");
        });
      });
    });
    return () => {
      removeMessageListener();
      removeNewChannelListener();
    };
  }, []);

  const getUserChannels = ({ pageNumber }: { pageNumber: number }) => {
    if (isFetchingNextChannelsRef.current) {
      return;
    }
    isFetchingNextChannelsRef.current = true;

    const pageSize = 20;
    client
      .getUserChannelsAsync({
        limit: pageSize,
        offset: pageNumber * pageSize,
      })
      .then((data) => {
        setChannels(data.channels);
        isLastPageRef.current = data.isLastPage;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        isFetchingNextChannelsRef.current = false;
        setIsLoading(false);
      });
  };

  const onEndReached = () => {
    if (!isLoading && !isLastPageRef.current) {
      pageNumberRef.current++;
      getUserChannels({ pageNumber: pageNumberRef.current });
    }
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
    <FlatList
      data={channels}
      keyExtractor={(item) => item.channelId}
      contentContainerStyle={styles.contentContainer}
      renderItem={({ item }) => (
        <ChannelItem channel={item} onPressChannel={onPressChannel} />
      )}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: colors.lightGray }} />
      )}
      extraData={refreshList}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={() => {
        return (
          <View style={styles.emptyList}>
            <Text>No chats yet</Text>
          </View>
        );
      }}
    />
  );
};

const ChannelItem = ({
  channel,
  onPressChannel,
}: {
  channel: Channel;
  onPressChannel?: (channel: Channel) => void;
}) => {
  const [unreadCount, setUnreadCount] = useState(channel.unreadCount);

  const displayDetails = channel.getDisplayDetails();

  useEffect(() => {
    const removeChannelUpdateListner = channel.on(
      "channel.updateUnReadCount",
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
      return "";
    }

    const date = new Date(timeStamp);
    const today = new Date();
    if (date.getDate() === today.getDate()) {
      return date.toLocaleTimeString(undefined, {
        timeStyle: "short",
      });
    } else if (date.getDate() === today.getDate() - 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.msgWrapper}>
      <Pressable
        style={styles.msgButton}
        onPress={() => onPressChannel?.(channel)}
      >
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
              style={styles.messageText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {channel?.lastMessage?.attachments?.[0]
                ? "📎 Attachment"
                : channel?.lastMessage?.text ?? "New message"}
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
  contentContainer: {
    height: "100%",
  },
  unreadCountText: {
    color: colors.white,
    fontSize: 12,
  },
  unreadCountContainer: {
    backgroundColor: colors.darkMint,
    borderRadius: 20,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pressable: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  msgWrapper: {
    paddingHorizontal: 20,
    justifyContent: "center",
    paddingVertical: 12,
  },
  msgButton: { flexDirection: "row", alignItems: "center" },
  profileImage: {
    height: 40,
    width: 40,
    borderRadius: 40,
    backgroundColor: "blue",
    justifyContent: "center",
    alignItems: "center",
  },
  msgContainer: { marginLeft: 16, flex: 1 },
  userNameTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
  },
  messageText: {
    fontWeight: "400",
    fontSize: 16,
    color: colors.grayMediumLight,
    maxWidth: "90%",
  },
  displayName: { fontWeight: "600", fontSize: 18, flex: 1, paddingRight: 12 },
  timeText: { fontSize: 12, color: colors.grayMediumLight },
  emptyList: {
    marginTop: 20,
    alignItems: "center",
  },
});
