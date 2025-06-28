'use client';
import { useState } from 'react';
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { FEATURES, STEPS, TESTIMONIALS } from "@/lib/landing";
import AIAssistant from '@/components/AIAssistant';// Sample initial data for demonstration
const initialUsers = [
  { id: "user1", name: "You", balance: 0 },
  { id: "user2", name: "Dheeraj", balance: 0 },
  { id: "user3", name: "Lara", balance: 0 },
  { id: "user4", name: "Hemanth", balance: 0 },
  { id: "user5", name: "Rakesh", balance: 0 }
];

const initialGroups = [
  { id: "group1", name: "Movie Buddies", members: ["user1", "user2"] },
  { id: "group2", name: "Flat Mates", members: ["user1", "user3", "user4", "user5"] }
];

export default function LandingPage() {
  const [users, setUsers] = useState(initialUsers);
  const [groups, setGroups] = useState(initialGroups);

  const handleCommand = (command) => {
    const parsed = parseCommand(command, users);
    
    switch(parsed.type) {
      case 'split':
        const share = parsed.amount / parsed.participants.length;
        setUsers(users.map(user => 
          parsed.participants.includes(user.name) 
            ? parsed.payer === user.name 
              ? { ...user, balance: user.balance + (parsed.amount - share) }
              : { ...user, balance: user.balance - share }
            : user
        ));
        break;
        
      case 'createGroup':
        const validMembers = parsed.members.filter(member => 
          users.some(u => u.name === member)
        );
        setGroups([...groups, {
          id: `group${groups.length + 1}`,
          name: parsed.groupName,
          members: validMembers.map(m => users.find(u => u.name === m).id)
        }]);
        break;
        
      default:
        console.log("Command not understood:", command);
    }
  };

  return (
    <div className="flex flex-col pt-16">
      {/* ───── Hero ───── */}
      <section className="mt-20 pb-12 space-y-10 md:space-y-15 px-5">
        <div className="container mx-auto px-4 md:px-6 text-center space-y-6">
          <Badge variant="outline" className="bg-green-100 text-green-700">
            Track. Split. Done.
          </Badge>

          <h1 className="gradient-title mx-auto max-w-6xl text-4xl font-bold md:text-8xl">
            Because Friendship Deserves Better than Math.
          </h1>

          <div className="flex flex-col items-center gap-4 sm:flex-row justify-center">
            <Button
              asChild
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="outline" className="bg-green-100 text-green-700">
            Features
          </Badge>
          <h2 className="gradient-title mt-2 text-3xl md:text-4xl">
            Everything you need to split expenses
          </h2>
          <p className="mx-auto mt-3 max-w-[700px] text-gray-500 md:text-xl/relaxed">
            Our platform provides all the tools you need to handle shared
            expenses with ease.
          </p>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, Icon, bg, color, description }) => (
              <Card
                key={title}
                className="flex flex-col items-center space-y-4 p-6 text-center"
              >
                <div className={`rounded-full p-3 ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>

                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-gray-500">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="outline" className="bg-green-100 text-green-700">
            How It Works
          </Badge>
          <h2 className="gradient-title mt-2 text-3xl md:text-4xl">
            Splitting expenses has never been easier
          </h2>
          <p className="mx-auto mt-3 max-w-[700px] text-gray-500 md:text-xl/relaxed">
            Follow these simple steps to start tracking and splitting expenses
            with friends.
          </p>

          <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
            {STEPS.map(({ label, title, description }) => (
              <div key={label} className="flex flex-col items-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-600">
                  {label}
                </div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-gray-500 text-center">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── AI Assistant ───── */}
      <section id="ai-assistant" className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="bg-green-100 text-green-700">
              AI Powered
            </Badge>
            <h2 className="gradient-title mt-2 text-3xl md:text-4xl">
              Smart Expense Splitting
            </h2>
            <p className="mx-auto mt-3 max-w-[700px] text-gray-500 md:text-xl/relaxed">
              Use voice commands or natural language to add and split expenses instantly. 
              Just speak or type what you spent!
            </p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-4xl">
              <AIAssistant />
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              Try saying: "Add ₹1200 for groceries split between Alice, Bob and me" 
              or "Split ₹500 for dinner with John and Sarah"
            </p>
          </div>
        </div>
      </section>


      {/* ───── Call‑to‑Action ───── */}
      <section className="py-20 gradient">
        <div className="container mx-auto px-4 md:px-6 text-center space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
            Ready to simplify expense sharing?
          </h2>
          <p className="mx-auto max-w-[600px] text-green-100 md:text-xl/relaxed">
            Join thousands of users who have made splitting expenses
            stress‑free.
          </p>
          <Button asChild size="lg" className="bg-green-800 hover:opacity-90">
            <Link href="/dashboard">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
