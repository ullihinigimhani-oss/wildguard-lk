import { useState } from "react";
export default function Avatar({ user, large = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={"avatar" + (large ? " large-avatar" : "")}>
      {user.profileImageUrl && !failed ? (
        <img
          src={user.profileImageUrl}
          alt={user.name + " profile"}
          onError={() => setFailed(true)}
        />
      ) : (
        user.name?.slice(0, 1) || "?"
      )}
    </span>
  );
}
