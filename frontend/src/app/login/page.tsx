"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import axios from "axios";
import OtpInput from "../../components/Otp/OtpInput";
import { config } from "../../config";

// Using a basic Spinner component directly inline
const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      setErrorMessage(error?.response?.data?.error || "OTP verification failed.");
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-panel rounded-2xl p-8 shadow-2xl">
        <div className="relative">
          <div className="text-center mb-8 flex flex-col items-center justify-center">
            <div className="relative h-14 w-64 mb-4 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <Image 
                src="/logo.png" 
                alt="Wissen Research Logo" 
                fill
                className="object-contain" 
                priority
              />
            </div>
            <h2 className="text-lg text-slate-400">
              {!isOtpWindow ? "Sign in to your account" : "OTP Verification"}
            </h2>
          </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-center text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {!isOtpWindow ? (
          <form
            key="login-form"
            className="w-full"
            onSubmit={handleSubmit(onLoginSubmit)}
          >
            <div className="mb-5">
              <label
                htmlFor="email"
                className="block mb-2 text-slate-300 font-medium text-sm"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register("email", { required: "Email is required" })}
                className={`relative z-20 w-full p-3.5 bg-slate-900 border rounded-xl outline-none text-white focus:ring-2 focus:ring-indigo-500 transition-all ${
                  errors?.email ? "border-red-500 focus:border-red-500" : "border-slate-600 focus:border-indigo-500"
                }`}
              />
              {errors?.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors?.email?.message as string}
                </p>
              )}
            </div>
            <div className="mb-6">
              <div className="flex justify-between">
                <label
                  htmlFor="password"
                  className="block mb-2 text-slate-300 font-medium text-sm"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="text-slate-400 hover:text-indigo-400 transition-colors text-sm"
                  aria-label="Toggle password visibility"
                >
                  {passwordVisible ? (
                    <div className="flex items-center gap-1.5">
                      <FaEye size={14} /> Show
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <FaEyeSlash size={14} /> Hide
                    </div>
                  )}
                </button>
              </div>
              <input
                id="password"
                type={passwordVisible ? "text" : "password"}
                placeholder="••••••••"
                {...register("password", { required: "Password is required" })}
                className={`relative z-20 w-full p-3.5 bg-slate-900 border rounded-xl outline-none text-white focus:ring-2 focus:ring-indigo-500 transition-all ${
                  errors?.password ? "border-red-500 focus:border-red-500" : "border-slate-600 focus:border-indigo-500"
                }`}
              />

              {errors?.password && (
                <p className="text-red-500 text-xs mt-1.5">
                  {errors?.password?.message as string}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3.5 font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              disabled={isPending}
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
          <form
            key="otp-form"
            className="w-full"
            onSubmit={handleSubmit(onOtpSubmit)}
          >
            <p className="text-slate-400 text-sm text-center mb-8">
              We've sent a 6-digit one-time password to your email.
            </p>

            <OtpInput register={register} setValue={setValue} errors={errors} />

            {errors?.otp && (
              <p className="text-red-500 text-xs mb-4">OTP is required.</p>
            )}

            <div className="flex flex-col gap-3 mt-8">
              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                disabled={OtpLoading}
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
                  reset({ email: watch("email"), password: watch("password") });
                }}
                className="w-full py-3.5 rounded-xl font-bold bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
              >
                Cancel
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
