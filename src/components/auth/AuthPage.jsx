import {
    useState,
} from "react";

import {
    ArrowRight,
    LockKeyhole,
    Mail,
    Sparkles,
} from "lucide-react";

import {
    setAuthToken,
} from "../../services/chatService";


const API_BASE_URL = "https://nova-ai-chatbot-1gwj.onrender.com";


function AuthPage({
    onAuthenticated,
}) {

    /*
     * LOGIN / SIGNUP MODE
     */

    const [
        mode,
        setMode,
    ] = useState("login");


    /*
     * FORM DATA
     */

    const [
        email,
        setEmail,
    ] = useState("");


    const [
        password,
        setPassword,
    ] = useState("");


    /*
     * UI STATE
     */

    const [
        loading,
        setLoading,
    ] = useState(false);


    const [
        error,
        setError,
    ] = useState("");


    /*
     * SWITCH LOGIN / SIGNUP
     */

    const switchMode =
        () => {

            setMode(
                mode === "login"
                    ? "signup"
                    : "login"
            );

            setError("");

            setPassword("");
        };


    /*
     * SUBMIT
     */

    const handleSubmit =
        async (event) => {

            event.preventDefault();

            setError("");


            const cleanEmail =
                email.trim();


            /*
             * BASIC VALIDATION
             */

            if (!cleanEmail) {

                setError(
                    "Please enter your email address."
                );

                return;
            }


            if (!cleanEmail.includes("@")) {

                setError(
                    "Please enter a valid email address."
                );

                return;
            }


            if (!password) {

                setError(
                    "Please enter your password."
                );

                return;
            }


            if (password.length < 6) {

                setError(
                    "Password must be at least 6 characters."
                );

                return;
            }


            setLoading(
                true
            );


            try {

                const endpoint =
                    mode === "login"
                        ? "/auth/login"
                        : "/auth/signup";


                const response =
                    await fetch(
                        `${API_BASE_URL}${endpoint}`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                email:
                                    cleanEmail,

                                password:
                                    password,
                            }),
                        }
                    );


                let data = null;


                try {

                    data =
                        await response.json();

                } catch {

                    data = null;
                }


                /*
                 * BACKEND ERROR
                 */

                if (!response.ok) {

                    let message =
                        "Something went wrong. Please try again.";


                    if (
                        data?.detail
                    ) {

                        if (
                            typeof data.detail ===
                            "string"
                        ) {

                            message =
                                data.detail;

                        } else {

                            message =
                                "Please check your information and try again.";
                        }
                    }


                    setError(
                        message
                    );

                    return;
                }


                /*
                 * TOKEN
                 */

                if (
                    !data?.access_token
                ) {

                    setError(
                        "Authentication succeeded, but no access token was returned."
                    );

                    return;
                }


                /*
                 * SAVE TOKEN
                 */

                setAuthToken(
                    data.access_token
                );


                /*
                 * SAVE USER
                 */

                if (
                    data?.user
                ) {

                    localStorage.setItem(
                        "nova_user",
                        JSON.stringify(
                            data.user
                        )
                    );

                } else {

                    localStorage.setItem(
                        "nova_user",
                        JSON.stringify({
                            email:
                                cleanEmail,
                        })
                    );
                }


                /*
                 * TELL APP LOGIN IS COMPLETE
                 */

                onAuthenticated(
                    data.user || {
                        email:
                            cleanEmail,
                    }
                );

            } catch (requestError) {

                console.error(
                    "Authentication error:",
                    requestError
                );


                setError(
                    "Could not connect to Nova. Make sure the backend is running."
                );

            } finally {

                setLoading(
                    false
                );
            }
        };


    const isLogin =
        mode === "login";


    return (
        <div className="auth-page">

            <div
                className="auth-background-glow"
            />


            <div className="auth-card">

                {/* =====================================================
            BRAND
            ===================================================== */}

                <div className="auth-brand">

                    <div className="auth-brand-icon">

                        <Sparkles />

                    </div>


                    <span>
                        NOVA
                    </span>

                </div>


                {/* =====================================================
            HEADING
            ===================================================== */}

                <div className="auth-heading">

                    <h1>
                        {isLogin
                            ? "Welcome back"
                            : "Create your account"}
                    </h1>


                    <p>
                        {isLogin
                            ? "Sign in to continue to Nova."
                            : "Create your personal Nova workspace."}
                    </p>

                </div>


                {/* =====================================================
            FORM
            ===================================================== */}

                <form
                    className="auth-form"
                    onSubmit={
                        handleSubmit
                    }
                >

                    {/* EMAIL */}

                    <div className="auth-field">

                        <label htmlFor="nova-email">
                            Email
                        </label>


                        <div className="auth-input-wrapper">

                            <span className="auth-input-icon">

                                <Mail />

                            </span>


                            <input
                                id="nova-email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(
                                        event.target.value
                                    )
                                }
                                placeholder="you@example.com"
                                autoComplete="email"
                                disabled={loading}
                            />

                        </div>

                    </div>


                    {/* PASSWORD */}

                    <div className="auth-field">

                        <label htmlFor="nova-password">
                            Password
                        </label>


                        <div className="auth-input-wrapper">

                            <span className="auth-input-icon">

                                <LockKeyhole />

                            </span>


                            <input
                                id="nova-password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(
                                        event.target.value
                                    )
                                }
                                placeholder="Enter your password"
                                autoComplete={
                                    isLogin
                                        ? "current-password"
                                        : "new-password"
                                }
                                disabled={loading}
                            />

                        </div>

                    </div>


                    {/* ERROR */}

                    {error && (

                        <div className="auth-error">

                            {error}

                        </div>

                    )}


                    {/* SUBMIT */}

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={loading}
                    >

                        {loading ? (

                            <div className="auth-spinner" />

                        ) : (

                            <>
                                <span>
                                    {isLogin
                                        ? "Sign in"
                                        : "Create account"}
                                </span>

                                <ArrowRight />

                            </>

                        )}

                    </button>

                </form>


                {/* =====================================================
            SWITCH
            ===================================================== */}

                <div className="auth-switch">

                    <span>
                        {isLogin
                            ? "Don't have an account?"
                            : "Already have an account?"}
                    </span>


                    <button
                        type="button"
                        onClick={
                            switchMode
                        }
                    >

                        {isLogin
                            ? "Create one"
                            : "Sign in"}

                    </button>

                </div>


                {/* =====================================================
            PRIVACY
            ===================================================== */}

                <div className="auth-note">

                    Your conversations are private to your account.

                </div>

            </div>

        </div>
    );
}


export default AuthPage;