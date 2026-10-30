import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function SellerRegister() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      await api("/auth/register", {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      });

      setSuccess(true);
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#d7dee8] bg-white px-4 py-3.5 text-[#27364f] outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-5">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <i className="fa-solid fa-clock text-2xl" />
          </div>

          <h1 className="text-2xl font-bold text-[#18283e]">
            Registration Submitted!
          </h1>

          <p className="mt-3 leading-7 text-[#72839b]">
            Your seller account has been created and is awaiting Coordinator
            approval. You can sign in once your account is approved.
          </p>

          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="mt-7 w-full rounded-xl bg-gradient-to-r from-[#ff7900] to-[#ff6500] p-4 font-bold text-white transition hover:brightness-95"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-5">
      <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-lg sm:p-10">
        <Link
          to="/login"
          className="text-sm font-medium text-orange-600 hover:underline"
        >
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Sign In
        </Link>

        <div className="mb-7 mt-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff7900] to-[#ec5500] text-2xl text-white">
            <i className="fa-solid fa-box" />
          </div>

          <h1 className="text-3xl font-bold text-[#18283e]">
            Seller Registration
          </h1>
          <p className="mt-2 text-[#72839b]">
            Create your LogiSync seller account
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          <i className="fa-solid fa-circle-info mr-2" />
          Your account must be approved by a Coordinator before you can sign in.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="seller-name"
              className="mb-2 block text-sm font-bold text-[#64748b]"
            >
              Full Name
            </label>
            <input
              id="seller-name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="seller-email"
              className="mb-2 block text-sm font-bold text-[#64748b]"
            >
              Email Address
            </label>
            <input
              id="seller-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="seller-password"
              className="mb-2 block text-sm font-bold text-[#64748b]"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="seller-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#72839b]"
              >
                <i
                  className={`fa-regular ${
                    showPassword ? "fa-eye-slash" : "fa-eye"
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="seller-confirm-password"
              className="mb-2 block text-sm font-bold text-[#64748b]"
            >
              Confirm Password
            </label>
            <input
              id="seller-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className={inputClass}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#ff7900] to-[#ff6500] p-4 font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating Account..." : "Create Seller Account →"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#72839b]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-orange-600 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}