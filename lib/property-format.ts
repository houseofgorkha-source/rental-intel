type StorageClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

export function getPropertyImageUrl(supabase: StorageClient, storagePath: string): string {
  return supabase.storage.from("property-images").getPublicUrl(storagePath).data.publicUrl;
}

export function calculateAverageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
}

export function formatINRPerMonth(rent: number): string {
  return `₹${rent.toLocaleString("en-IN")}/month`;
}
