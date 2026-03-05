import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../config';
import { RootState } from '../store';

// ========================================
// Types
// ========================================

export interface MediaItem {
  url: string;
  publicId: string;
  type: 'image' | 'video';
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnail?: string | null;
}

export interface PostAuthor {
  _id: string;
  name: string;
  profileImage?: string;
}

export interface PostPet {
  _id: string;
  name: string;
  species: string;
}

export interface Post {
  _id: string;
  author: PostAuthor;
  pet?: PostPet | null;
  content: string;
  media: MediaItem[];
  tags: string[];
  location?: {
    type: string;
    coordinates: number[];
    name?: string;
  } | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  sharedPost?: Post | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  post: string;
  author: PostAuthor;
  content: string;
  parentComment?: string | null;
  likesCount: number;
  isLiked: boolean;
  createdAt: string;
}

interface PostState {
  feed: Post[];
  myPosts: Post[];
  userPosts: Post[];
  activePost: Post | null;
  comments: Comment[];
  loading: boolean;
  feedLoading: boolean;
  commentsLoading: boolean;
  creating: boolean;
  error: string | null;
  pagination: { page: number; total: number; pages: number };
  commentsPagination: { page: number; total: number; pages: number };
}

const initialState: PostState = {
  feed: [],
  myPosts: [],
  userPosts: [],
  activePost: null,
  comments: [],
  loading: false,
  feedLoading: false,
  commentsLoading: false,
  creating: false,
  error: null,
  pagination: { page: 1, total: 0, pages: 0 },
  commentsPagination: { page: 1, total: 0, pages: 0 },
};

// ========================================
// Helpers
// ========================================

const getToken = (getState: () => unknown) =>
  (getState() as RootState).auth.token;

const fetchWithAuth = async (
  url: string,
  token: string | null,
  options: RequestInit = {},
) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Request failed');
  return data;
};

// ========================================
// Thunks
// ========================================

export const fetchFeed = createAsyncThunk(
  'posts/fetchFeed',
  async (page: number = 1, { getState, rejectWithValue }) => {
    const token = getToken(getState);
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/feed?page=${page}&limit=20`,
        token,
      );
      return { posts: data.posts, pagination: data.pagination, page };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchMyPosts = createAsyncThunk(
  'posts/fetchMyPosts',
  async (_, { getState, rejectWithValue }) => {
    const token = getToken(getState);
    if (!token) return rejectWithValue('Not authenticated');
    try {
      const data = await fetchWithAuth(`${API_BASE_URL}/posts/mine`, token);
      return data.posts;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchUserPosts = createAsyncThunk(
  'posts/fetchUserPosts',
  async (userId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/user/${userId}`,
        token,
      );
      return data.posts;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const fetchPostDetail = createAsyncThunk(
  'posts/fetchPostDetail',
  async (postId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/${postId}`,
        token,
      );
      return data.post;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const createPost = createAsyncThunk(
  'posts/createPost',
  async (
    postData: {
      content?: string;
      media?: MediaItem[];
      tags?: string[];
      petId?: string;
      location?: { coordinates: number[]; name?: string };
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(`${API_BASE_URL}/posts`, token, {
        method: 'POST',
        body: JSON.stringify(postData),
      });
      return data.post;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const editPost = createAsyncThunk(
  'posts/editPost',
  async (
    {
      postId,
      ...updates
    }: {
      postId: string;
      content?: string;
      media?: MediaItem[];
      tags?: string[];
      location?: { coordinates: number[]; name?: string } | null;
    },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/${postId}`,
        token,
        { method: 'PUT', body: JSON.stringify(updates) },
      );
      return data.post;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (postId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/posts/${postId}`, token, {
        method: 'DELETE',
      });
      return postId;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const toggleLike = createAsyncThunk(
  'posts/toggleLike',
  async (postId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/${postId}/like`,
        token,
        { method: 'PUT' },
      );
      return { postId, isLiked: data.isLiked, likesCount: data.likesCount };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const sharePost = createAsyncThunk(
  'posts/sharePost',
  async (
    {
      postId,
      content,
      tags,
    }: { postId: string; content?: string; tags?: string[] },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/share/${postId}`,
        token,
        { method: 'POST', body: JSON.stringify({ content, tags }) },
      );
      return data.post;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// --- Comments ---

export const fetchComments = createAsyncThunk(
  'posts/fetchComments',
  async (
    { postId, page = 1 }: { postId: string; page?: number },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/${postId}/comments?page=${page}&limit=20`,
        token,
      );
      return {
        comments: data.comments,
        pagination: data.pagination,
        page,
      };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const addComment = createAsyncThunk(
  'posts/addComment',
  async (
    {
      postId,
      content,
      parentCommentId,
    }: { postId: string; content: string; parentCommentId?: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/${postId}/comments`,
        token,
        { method: 'POST', body: JSON.stringify({ content, parentCommentId }) },
      );
      return { comment: data.comment, postId };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const toggleCommentLike = createAsyncThunk(
  'posts/toggleCommentLike',
  async (commentId: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/comments/${commentId}/like`,
        token,
        { method: 'PUT' },
      );
      return {
        commentId,
        isLiked: data.isLiked,
        likesCount: data.likesCount,
      };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const deleteComment = createAsyncThunk(
  'posts/deleteComment',
  async (
    { commentId, postId }: { commentId: string; postId: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(
        `${API_BASE_URL}/posts/comments/${commentId}`,
        token,
        { method: 'DELETE' },
      );
      return { commentId, postId };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// --- User location & interests ---

export const updateUserLocation = createAsyncThunk(
  'posts/updateLocation',
  async (
    { longitude, latitude }: { longitude: number; latitude: number },
    { getState, rejectWithValue },
  ) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/posts/location`, token, {
        method: 'PUT',
        body: JSON.stringify({ longitude, latitude }),
      });
      return { longitude, latitude };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateUserInterests = createAsyncThunk(
  'posts/updateInterests',
  async (interests: string[], { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      await fetchWithAuth(`${API_BASE_URL}/posts/interests`, token, {
        method: 'PUT',
        body: JSON.stringify({ interests }),
      });
      return interests;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

export const searchUsers = createAsyncThunk(
  'posts/searchUsers',
  async (query: string, { getState, rejectWithValue }) => {
    try {
      const token = getToken(getState);
      const data = await fetchWithAuth(
        `${API_BASE_URL}/posts/search/users?q=${encodeURIComponent(query)}`,
        token,
      );
      return data.users;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  },
);

// ========================================
// Upload helper (used by CreatePostScreen, not a thunk)
// ========================================

export const uploadPostMedia = async (
  files: { uri: string; type: 'image' | 'video' }[],
  token: string,
): Promise<MediaItem[]> => {
  const formData = new FormData();

  for (const file of files) {
    const ext =
      file.uri.split('.').pop() || (file.type === 'video' ? 'mp4' : 'jpg');
    const mimeType =
      file.type === 'video'
        ? `video/${ext}`
        : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    formData.append('media', {
      uri: file.uri,
      name: `upload_${Date.now()}.${ext}`,
      type: mimeType,
    } as any);
  }
  formData.append('folder', 'petopia/posts');

  const res = await fetch(`${API_BASE_URL}/upload/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Upload failed');
  return data.media;
};

// ========================================
// Slice
// ========================================

const postSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearPostError: (state) => {
      state.error = null;
    },
    clearPosts: () => initialState,
    clearComments: (state) => {
      state.comments = [];
      state.commentsPagination = { page: 1, total: 0, pages: 0 };
    },
    setActivePost: (state, action: PayloadAction<Post | null>) => {
      state.activePost = action.payload;
    },
  },
  extraReducers: (builder) => {
    // --- Feed ---
    builder
      .addCase(fetchFeed.pending, (state, action) => {
        if (action.meta.arg === 1) state.feedLoading = true;
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.feedLoading = false;
        const { posts, pagination, page } = action.payload;
        if (page === 1) {
          state.feed = posts;
        } else {
          // Append for infinite scroll, deduplicate
          const ids = new Set(state.feed.map((p) => p._id));
          const newPosts = posts.filter((p: Post) => !ids.has(p._id));
          state.feed.push(...newPosts);
        }
        state.pagination = pagination;
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.feedLoading = false;
        state.error = action.payload as string;
      });

    // --- My posts ---
    builder.addCase(fetchMyPosts.fulfilled, (state, action) => {
      state.myPosts = action.payload;
    });

    // --- User posts ---
    builder.addCase(fetchUserPosts.fulfilled, (state, action) => {
      state.userPosts = action.payload;
    });

    // --- Post detail ---
    builder
      .addCase(fetchPostDetail.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPostDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.activePost = action.payload;
      })
      .addCase(fetchPostDetail.rejected, (state) => {
        state.loading = false;
      });

    // --- Create ---
    builder
      .addCase(createPost.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.creating = false;
        state.feed.unshift(action.payload);
        state.myPosts.unshift(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload as string;
      });

    // --- Edit ---
    builder.addCase(editPost.fulfilled, (state, action) => {
      const updated = action.payload;
      const updateIn = (arr: Post[]) => {
        const idx = arr.findIndex((p) => p._id === updated._id);
        if (idx >= 0) arr[idx] = { ...arr[idx], ...updated };
      };
      updateIn(state.feed);
      updateIn(state.myPosts);
      if (state.activePost?._id === updated._id) {
        state.activePost = { ...state.activePost, ...updated };
      }
    });

    // --- Delete ---
    builder.addCase(deletePost.fulfilled, (state, action) => {
      const id = action.payload;
      state.feed = state.feed.filter((p) => p._id !== id);
      state.myPosts = state.myPosts.filter((p) => p._id !== id);
      if (state.activePost?._id === id) state.activePost = null;
    });

    // --- Like ---
    builder.addCase(toggleLike.fulfilled, (state, action) => {
      const { postId, isLiked, likesCount } = action.payload;
      const updatePost = (posts: Post[]) => {
        const p = posts.find((x) => x._id === postId);
        if (p) {
          p.isLiked = isLiked;
          p.likesCount = likesCount;
        }
      };
      updatePost(state.feed);
      updatePost(state.myPosts);
      updatePost(state.userPosts);
      if (state.activePost?._id === postId) {
        state.activePost.isLiked = isLiked;
        state.activePost.likesCount = likesCount;
      }
    });

    // --- Share ---
    builder.addCase(sharePost.fulfilled, (state, action) => {
      state.feed.unshift(action.payload);
      state.myPosts.unshift(action.payload);
      // Increment sharesCount on original
      const origId = action.payload.sharedPost?._id;
      if (origId) {
        const updatePost = (posts: Post[]) => {
          const p = posts.find((x) => x._id === origId);
          if (p) p.sharesCount += 1;
        };
        updatePost(state.feed);
        updatePost(state.myPosts);
        if (state.activePost?._id === origId) {
          state.activePost.sharesCount += 1;
        }
      }
    });

    // --- Comments ---
    builder
      .addCase(fetchComments.pending, (state) => {
        state.commentsLoading = true;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.commentsLoading = false;
        const { comments, pagination, page } = action.payload;
        if (page === 1) {
          state.comments = comments;
        } else {
          const ids = new Set(state.comments.map((c) => c._id));
          const newComments = comments.filter((c: Comment) => !ids.has(c._id));
          state.comments.push(...newComments);
        }
        state.commentsPagination = pagination;
      })
      .addCase(fetchComments.rejected, (state) => {
        state.commentsLoading = false;
      });

    builder.addCase(addComment.fulfilled, (state, action) => {
      const { comment, postId } = action.payload;
      state.comments.push(comment);
      // Increment commentsCount in all post arrays
      const updatePost = (posts: Post[]) => {
        const p = posts.find((x) => x._id === postId);
        if (p) p.commentsCount += 1;
      };
      updatePost(state.feed);
      updatePost(state.myPosts);
      updatePost(state.userPosts);
      if (state.activePost?._id === postId) {
        state.activePost.commentsCount += 1;
      }
    });

    builder.addCase(toggleCommentLike.fulfilled, (state, action) => {
      const { commentId, isLiked, likesCount } = action.payload;
      const c = state.comments.find((x) => x._id === commentId);
      if (c) {
        c.isLiked = isLiked;
        c.likesCount = likesCount;
      }
    });

    builder.addCase(deleteComment.fulfilled, (state, action) => {
      const { commentId, postId } = action.payload;
      state.comments = state.comments.filter((c) => c._id !== commentId);
      const updatePost = (posts: Post[]) => {
        const p = posts.find((x) => x._id === postId);
        if (p) p.commentsCount = Math.max(0, p.commentsCount - 1);
      };
      updatePost(state.feed);
      updatePost(state.myPosts);
      updatePost(state.userPosts);
      if (state.activePost?._id === postId) {
        state.activePost.commentsCount = Math.max(
          0,
          state.activePost.commentsCount - 1,
        );
      }
    });
  },
});

export const { clearPostError, clearPosts, clearComments, setActivePost } =
  postSlice.actions;
export default postSlice.reducer;
