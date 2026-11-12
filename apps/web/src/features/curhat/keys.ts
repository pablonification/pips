import { chatroomsQuery } from '~/api/queries';

/** The rooms (`GET /curhat/chatrooms`). */
export const ROOMS_KEY = chatroomsQuery().queryKey;
