"use client";

interface ImageCardProps {
  imageUrl?: string;
  alt?: string;
  title?: string;
  caption?: string;
}

export default function ImageCard({ 
  imageUrl = "/image-placeholder.jpg", 
  alt = "Featured Image",
  title
}: ImageCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4">

      <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-100">
        <img 
          src={imageUrl} 
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // 如果图片加载失败，显示一个占位符
            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 300 300'%3E%3Crect fill='%23f0f0f0' width='300' height='300'/%3E%3Ctext fill='%23999999' font-family='Arial' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
          }}
        />
      </div>

      {title && (
        <h3 className="px-1 pt-2 text-lg font-bold text-gray-700">{title}</h3>
      )}
    </div>
  );
} 