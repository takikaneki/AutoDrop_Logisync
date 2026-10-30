import { useProfile } from "../store/profile.js";

// Avatar ng naka-login na user (may uploaded photo kung meron)
export default function UserAvatar({ className = "w-[42px] h-[42px]" }) {
  const { avatar, initial } = useProfile();
  return avatar ? (
    <img src={avatar} alt="Profile" className={`${className} rounded-full object-cover`} />
  ) : (
    <div className={`${className} rounded-full bg-brand text-white flex items-center justify-center font-bold`}>{initial}</div>
  );
}
