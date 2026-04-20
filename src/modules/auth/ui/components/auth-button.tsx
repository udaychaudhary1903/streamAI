"use client";

import { UserButton, SignInButton, useUser, Show } from "@clerk/nextjs";

import { Button } from "@/components/ui/button"
import { ClapperboardIcon, UserCircleIcon } from "lucide-react"

export const AuthButton =() => {

    return (
        <>
        <Show when="signed-in">
           <UserButton>
               <UserButton.MenuItems>
                {/* ADD USER PROFILE */}
                    <UserButton.Link 
                       label="Studio"
                       href="/studio"
                       labelIcon={<ClapperboardIcon className="'size-4" />}
                    />
                    {/* this below adjust the studio above the manage account */}
                    <UserButton.Action label="manageAccount" />
               </UserButton.MenuItems>
           </UserButton>
           
        </Show>
        <Show when="signed-out">
        <SignInButton mode="modal">
        <Button
            variant="outline"
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 border-blue-500/20 rounded-full shadow-none"
        >
            <UserCircleIcon />
                Sign In
        </Button>
        </SignInButton>
        </Show>
        </>
    );
};