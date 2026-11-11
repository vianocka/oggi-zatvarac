import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout} className="self-center sm:self-start">
      <button type="submit" className="btn-ghost">
        Odhlásiť sa
      </button>
    </form>
  );
}
