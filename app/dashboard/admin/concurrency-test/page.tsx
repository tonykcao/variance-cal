"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Clock,
} from "lucide-react"

interface TestResult {
  userId: string
  userName: string
  success: boolean
  message: string
  timestamp: number
}

interface TestRun {
  id: string
  startTime: Date
  endTime?: Date
  results: TestResult[]
  bookingCreated?: {
    id: string
    owner: string
    room?: string
    site?: string
    startLocal?: string
    endLocal?: string
  }
  testDetails?: {
    room: string
    site: string
    timezone: string
    startLocal: string
    endLocal: string
    startUtc: string
    endUtc: string
    slotsCount: number
  }
  status: "running" | "completed" | "error"
}

export default function ConcurrencyTestPage() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null)

  const runConcurrencyTest = async () => {
    setIsRunning(true)

    const runId = `run-${Date.now()}`
    const newRun: TestRun = {
      id: runId,
      startTime: new Date(),
      results: [],
      status: "running",
    }

    setCurrentRun(newRun)
    setTestRuns(prev => [newRun, ...prev])

    try {
      // Call the concurrency test API endpoint
      const response = await fetch("/api/admin/concurrency-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rounds: 1 }),
      })

      if (!response.ok) {
        throw new Error("Failed to run concurrency test")
      }

      const data = await response.json()

      // Update the test run with results
      const completedRun: TestRun = {
        ...newRun,
        endTime: new Date(),
        results: data.results,
        bookingCreated: data.bookingCreated,
        testDetails: data.testDetails,
        status: "completed",
      }

      setCurrentRun(completedRun)
      setTestRuns(prev => prev.map(run => (run.id === runId ? completedRun : run)))
    } catch (error) {
      console.error("Concurrency test error:", error)

      const errorRun: TestRun = {
        ...newRun,
        endTime: new Date(),
        status: "error",
      }

      setCurrentRun(errorRun)
      setTestRuns(prev => prev.map(run => (run.id === runId ? errorRun : run)))
    } finally {
      setIsRunning(false)
    }
  }

  const clearHistory = () => {
    setTestRuns([])
    setCurrentRun(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Concurrency Testing</h1>
        <p className="text-muted-foreground">
          Test the system's ability to prevent double-bookings under concurrent load
        </p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Double-Booking Prevention Test</CardTitle>
          <CardDescription>
            Simulates 3 users attempting to book the same time slot simultaneously. Only one booking
            should succeed due to our database constraints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={runConcurrencyTest}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Run Concurrency Test
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={clearHistory}
              disabled={isRunning || testRuns.length === 0}
            >
              Clear History
            </Button>
          </div>

          {/* Current Test Status */}
          {currentRun && (
            <Alert
              className={
                currentRun.status === "running"
                  ? "border-blue-500"
                  : currentRun.status === "completed"
                    ? "border-green-500"
                    : "border-red-500"
              }
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {currentRun.status === "running" && "Test in Progress"}
                {currentRun.status === "completed" && "Test Completed"}
                {currentRun.status === "error" && "Test Failed"}
              </AlertTitle>
              <AlertDescription>
                {currentRun.status === "running" && "Simulating concurrent booking attempts..."}
                {currentRun.status === "completed" && (
                  <div className="mt-2 space-y-2">
                    {currentRun.testDetails && (
                      <div className="p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                        <div>
                          <strong>Test Target:</strong> {currentRun.testDetails.room} at{" "}
                          {currentRun.testDetails.site}
                        </div>
                        <div>
                          <strong>Time Slot:</strong> {currentRun.testDetails.startLocal} -{" "}
                          {currentRun.testDetails.endLocal.split(" ")[1]} (
                          {currentRun.testDetails.timezone})
                        </div>
                        <div>
                          <strong>Slots Tested:</strong> {currentRun.testDetails.slotsCount} ×
                          30-minute slots
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>
                        {currentRun.results.length} users attempted to book simultaneously
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>
                        {currentRun.results.filter(r => r.success).length} booking(s) succeeded
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>
                        {currentRun.results.filter(r => !r.success).length} booking(s) blocked
                        (expected)
                      </span>
                    </div>
                    {currentRun.endTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          Test duration:{" "}
                          {(
                            (currentRun.endTime.getTime() - currentRun.startTime.getTime()) /
                            1000
                          ).toFixed(2)}
                          s
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {currentRun.status === "error" && "An error occurred while running the test"}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Results History */}
      {testRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test History</CardTitle>
            <CardDescription>Results from previous test runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testRuns.map(run => (
                <div key={run.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {run.startTime.toLocaleTimeString()}
                      </span>
                    </div>
                    {run.endTime && (
                      <span className="text-sm text-muted-foreground">
                        Duration:{" "}
                        {((run.endTime.getTime() - run.startTime.getTime()) / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>

                  {run.results.length > 0 && (
                    <div className="space-y-2">
                      {run.results.map((result, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {result.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{result.userName}:</span>
                          <span className="text-muted-foreground">{result.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {run.bookingCreated && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <span className="font-medium">Booking Created:</span> ID{" "}
                      {run.bookingCreated.id.slice(-8)}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.bookingCreated.room && (
                          <div>
                            Room: {run.bookingCreated.room} at {run.bookingCreated.site}
                          </div>
                        )}
                        {run.bookingCreated.startLocal && (
                          <div>
                            Time: {run.bookingCreated.startLocal} -{" "}
                            {run.bookingCreated.endLocal?.split(" ")[1]}
                          </div>
                        )}
                        <div>Owner: {run.bookingCreated.owner}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explanation Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This test demonstrates the system's ability to handle concurrent booking requests
            safely.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              3 different users (Alice, Bob, Connor) attempt to book the same room at the same time
            </li>
            <li>All requests are sent simultaneously to simulate real concurrent access</li>
            <li>
              The database's unique constraint on (roomId, slotStartUtc) prevents double-booking
            </li>
            <li>Only one user will successfully create the booking</li>
            <li>Other users receive a "time slot already booked" error</li>
          </ul>
          <p>
            This ensures data integrity even under high concurrent load, preventing scheduling
            conflicts.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
