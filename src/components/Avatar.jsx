"use client";

import Image from "next/image";
import { getImageUrl, getInitials } from "@/lib/imageUtils";

export default function Avatar({
  photoUrl,
  name,
  email,
  size = 40,
  className = "",
  style = {},
  showBorder = false,
}) {
  const imageUrl = getImageUrl(photoUrl);
  const displayName = name || email || "?";
  const initials = getInitials(displayName);

  const avatarStyle = {
    width: `${size}px`,
    height: `${size}px`,
    ...style,
  };

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={displayName}
        width={size}
        height={size}
        className={`rounded-circle ${className}`}
        style={{
          objectFit: "cover",
          ...(showBorder && { border: "2px solid #FF2D95" }),
          ...avatarStyle,
        }}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`rounded-circle d-flex align-items-center justify-content-center ${className}`}
      style={{
        ...avatarStyle,
        backgroundColor: "rgba(255, 45, 149, 0.3)",
        color: "white",
        fontSize: `${size * 0.4}px`,
        fontWeight: "bold",
        ...(showBorder && { border: "2px solid #FF2D95" }),
      }}
    >
      {initials}
    </div>
  );
}
