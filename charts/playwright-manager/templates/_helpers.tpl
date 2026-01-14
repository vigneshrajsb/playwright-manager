{{/*
Expand the name of the chart.
*/}}
{{- define "playwright-manager.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "playwright-manager.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "playwright-manager.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "playwright-manager.labels" -}}
helm.sh/chart: {{ include "playwright-manager.chart" . }}
{{ include "playwright-manager.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.extraLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "playwright-manager.selectorLabels" -}}
app.kubernetes.io/name: {{ include "playwright-manager.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "playwright-manager.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "playwright-manager.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the configmap
*/}}
{{- define "playwright-manager.configName" -}}
{{- printf "%s-config" (include "playwright-manager.fullname" .) }}
{{- end }}

{{/*
Create the name of the secret
*/}}
{{- define "playwright-manager.secretName" -}}
{{- printf "%s-secret" (include "playwright-manager.fullname" .) }}
{{- end }}

{{/*
Return the image name
*/}}
{{- define "playwright-manager.image" -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion }}
{{- printf "%s:%s" .Values.image.repository $tag }}
{{- end }}

{{/*
Return the PostgreSQL host
*/}}
{{- define "playwright-manager.postgresql.host" -}}
{{- printf "%s-postgresql" .Release.Name }}
{{- end }}

{{/*
Return the DATABASE_URL constructed from PostgreSQL values
*/}}
{{- define "playwright-manager.databaseUrl" -}}
{{- printf "postgresql://postgres:%s@%s:5432/%s" .Values.postgresql.auth.postgresPassword (include "playwright-manager.postgresql.host" .) .Values.postgresql.auth.database }}
{{- end }}
