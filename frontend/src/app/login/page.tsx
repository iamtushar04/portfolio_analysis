"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import axios from "axios";
import OtpInput from "../../components/OtpInput";
import { config } from "../../config";

// Using a basic Spinner component directly inline
const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

const OTP_LENGTH = 6;

const calculateExpiryTime = (hours: number) => {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return now.toISOString();
};

const Login = () => {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isOtpWindow, setIsOtpWindow] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [OtpLoading, setOtpLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm();

  const handleLoginSuccess = (data: any) => {
    const isSuccess = data?.access_token || data?.status === 200;

    if (isSuccess) {
      const oldUserId = localStorage.getItem("user_id");
      const newUserId = String(data?.id || data?.user_id || "auth-user");

      if (oldUserId && oldUserId !== newUserId) {
        localStorage.clear();
      }

      localStorage.setItem("token", data?.access_token);
      localStorage.setItem("user_id", newUserId);
      localStorage.setItem("token_expiry", calculateExpiryTime(2));
      localStorage.setItem("isAuth", "true");

      router.push("/");
    } else {
      localStorage.setItem("isAuth", "false");
      setErrorMessage("Login failed! Invalid credentials.");
    }
  };

  const loginMutation = async (payload: any) => {
    setIsPending(true);
    try {
      const response = await axios.post(config.AUTH_URL, payload);
      handleLoginSuccess(response.data);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 400) {
        setIsOtpWindow(true);
      } else {
        setErrorMessage(error?.response?.data?.error || "Login failed!");
      }
      localStorage.setItem("isAuth", "false");
    } finally {
      setIsPending(false);
    }
  };

  const otpMutation = async (payload: any) => {
    setOtpLoading(true);
    try {
      const response = await axios.post(config.AUTH_URL, payload);
      handleLoginSuccess(response.data);
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.error || "OTP verification failed.",
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const onLoginSubmit = (data: any) => {
    setErrorMessage("");
    loginMutation({
      email: data?.email,
      password: data?.password,
    });
  };

  const onOtpSubmit = (data: any) => {
    const otp = (data?.otp || []).join("");
    if (otp.length !== OTP_LENGTH) {
      setErrorMessage("Please enter the complete OTP.");
      return;
    }

    otpMutation({
      email: watch("email"),
      password: watch("password"),
      totp_token: otp,
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-2">
      <div className="w-fit px-5">
        {/* Main Card */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 w-full">
          {/* Logo & Heading */}
          <div className="text-center mb-8">
            {/* Full Wissen Research Logo */}
            <div className="rounded-xl h-16 w-80 mx-auto mb-7 flex items-center justify-center px-6">
              <div className="relative w-full h-12">
                <Image
                  src="/image.png"
                  alt="Wissen Research Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-slate-600 tracking-tight">
              {!isOtpWindow ? "Welcome back" : "Verify your identity"}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              {!isOtpWindow
                ? "Sign in to continue to your account"
                : "Enter the verification code sent to your email"}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
              {errorMessage}
            </div>
          )}

          {/* Login */}
          {!isOtpWindow ? (
            <form
              key="login-form"
              className="space-y-5"
              onSubmit={handleSubmit(onLoginSubmit)}
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm font-medium text-slate-600"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  {...register("email", {
                    required: "Email is required",
                  })}
                  className={`w-full h-12 px-4 rounded-lg border bg-white text-slate-600 placeholder:text-slate-400 outline-none transition-all ${
                    errors?.email
                      ? "border-red-400 focus:ring-2 focus:ring-red-100"
                      : "border-slate-300 focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
                  }`}
                />

                {errors?.email && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {errors.email.message as string}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-600"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-700 cursor-pointer transition-colors"
                  >
                    {passwordVisible ? (
                      <span className="flex items-center gap-1.5">
                        <FaEye size={13} color="black" />
                        Show
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <FaEyeSlash size={13} color="black" />
                        Hide
                      </span>
                    )}
                  </button>
                </div>

                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password", {
                    required: "Password is required",
                  })}
                  className={`w-full h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 outline-none transition-all ${
                    errors?.password
                      ? "border-red-400 focus:ring-2 focus:ring-red-100"
                      : "focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
                  }`}
                />

                {errors?.password && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {errors.password.message as string}
                  </p>
                )}
              </div>

              {/* Sign In */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-12 mt-2 rounded-lg bg-[#b90000] text-slate-200 font-semibold hover:bg-red-700 active:bg-red-800 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <div className="flex justify-center items-center">
                    <Spinner />
                  </div>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          ) : (
            /* OTP */
            <form
              key="otp-form"
              className="space-y-6"
              onSubmit={handleSubmit(onOtpSubmit)}
            >
              {/* OTP Icon & Description */}

              {/* OTP Input */}
              <OtpInput
                register={register}
                setValue={setValue}
                errors={errors}
              />

              {errors?.otp && (
                <p className="text-red-500 text-xs -mt-3">OTP is required.</p>
              )}

              {/* OTP Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={OtpLoading}
                  className="w-full h-12 rounded-lg bg-[#b90000] text-slate-200 cursor-pointer text-sm font-semibold hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {OtpLoading ? (
                    <div className="flex justify-center items-center">
                      <Spinner />
                    </div>
                  ) : (
                    "Verify OTP"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOtpWindow(false);
                    setErrorMessage("");
                    setValue("otp", []);
                    reset({
                      email: watch("email"),
                      password: watch("password"),
                    });
                  }}
                  className="w-full h-12 rounded-lg border border-slate-200 bg-slate-200 cursor-pointer text-slate-600 text-sm font-medium hover:bg-slate-300 active:bg-slate-400/50 transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
