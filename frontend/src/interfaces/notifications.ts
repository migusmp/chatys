export type Notification =
  | FriendRequestNotification
  |NewDmMessageNotification
  | ChatMessageNotification;

export type DmNotification = 
  | ChatMessageNotification
  | NewDmMessageNotification;

export interface FriendRequestNotification {
  id: number;
  message: string;
  sender_id: number;
  sender_name: string;
  status: string;
  type_msg: 'FR' | 'friend_request';
  user_id: number;
  image: string;
  created_at: string;
}

export interface ChatMessageNotification {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: string;
  undelivered_id: number;
  type_msg: 'chat_message';
  image: string;
}

export interface NewDmMessageNotification {
  type_msg: "NEW_DM_MESSAGE";
  conversation_id: number;
  from_user: number;
  to_user: number;
  created_at: string;
  from_user_username: string;
  from_user_image: string;
  content: string;
}
