package main

import (
	"context"
	"errors"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// secretParams maps a plain variable to the variable naming the SSM parameter
// that holds its value. Lambda environment variables cannot reference SSM and
// would expose the URLs in the console, so the function reads them at startup.
var secretParams = []struct{ plain, param string }{
	{"DATABASE_URL", "DATABASE_URL_SSM_PARAM"},
	{"MIGRATE_DATABASE_URL", "MIGRATE_DATABASE_URL_SSM_PARAM"},
}

// parameterGetter is the slice of the SSM client the resolver needs.
type parameterGetter interface {
	GetParameter(ctx context.Context, in *ssm.GetParameterInput, opts ...func(*ssm.Options)) (*ssm.GetParameterOutput, error)
}

// withSSMSecrets returns a getenv that serves secrets from SSM for each plain
// variable that is empty while its *_SSM_PARAM variable is set. A plain
// variable always wins. Errors name the parameter and never carry a value.
func withSSMSecrets(ctx context.Context, client parameterGetter, getenv func(string) string) (func(string) string, error) {
	resolved := map[string]string{}
	for _, s := range secretParams {
		name := getenv(s.param)
		if name == "" || getenv(s.plain) != "" {
			continue
		}
		out, err := client.GetParameter(ctx, &ssm.GetParameterInput{Name: &name, WithDecryption: boolPtr(true)})
		if err != nil {
			return nil, fmt.Errorf("read SSM parameter %s: %w", name, err)
		}
		if out.Parameter == nil || out.Parameter.Value == nil || *out.Parameter.Value == "" {
			return nil, fmt.Errorf("SSM parameter %s is empty", name)
		}
		resolved[s.plain] = *out.Parameter.Value
	}
	return func(k string) string {
		if v, ok := resolved[k]; ok {
			return v
		}
		return getenv(k)
	}, nil
}

// ssmGetenv wires withSSMSecrets to the real SSM client, creating it only when
// some parameter name is actually set so local runs need no AWS configuration.
func ssmGetenv(ctx context.Context, getenv func(string) string) (func(string) string, error) {
	need := false
	for _, s := range secretParams {
		if getenv(s.param) != "" && getenv(s.plain) == "" {
			need = true
		}
	}
	if !need {
		return getenv, nil
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, errors.New("load AWS config for SSM")
	}
	return withSSMSecrets(ctx, ssm.NewFromConfig(awsCfg), getenv)
}

func boolPtr(b bool) *bool { return &b }
