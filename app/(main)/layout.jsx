"use client";

import { Authenticated } from "convex/react";
import React from "react";

// You can add a header or footer here if you wish
const MainLayout = ({ children }) => (
  <Authenticated>
    <div className="container mx-auto mt-24 mb-20 px-4">
      {children}
    </div>
  </Authenticated>
);

export default MainLayout;
