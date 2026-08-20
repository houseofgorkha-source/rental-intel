type StorageClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

// Same shape as getPropertyImageUrl in lib/property-format.ts, kept as its
// own function rather than generalizing that one -- spotted-boards is a
// different bucket with a different (public, anon-writable) access model,
// and the two should never be able to drift into pointing at each other's
// bucket by accident.
export function getSpottedBoardImageUrl(supabase: StorageClient, storagePath: string): string {
  return supabase.storage.from("spotted-boards").getPublicUrl(storagePath).data.publicUrl;
}

export type SpottedBoard = {
  id: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  phone: string;
  city: string;
  area: string | null;
  createdAt: string;
};
