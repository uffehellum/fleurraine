// Package storage wraps the Tigris (S3-compatible) object storage client.
package storage

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Client is a thin wrapper around the S3 client configured for Tigris.
type Client struct {
	s3     *s3.Client
	bucket string
}

// New creates a Client from TIGRIS_* environment variables.
// Required: TIGRIS_BUCKET, TIGRIS_ACCESS_KEY_ID, TIGRIS_SECRET_ACCESS_KEY, TIGRIS_ENDPOINT_URL.
func New() (*Client, error) {
	bucket := os.Getenv("TIGRIS_BUCKET")
	accessKey := os.Getenv("TIGRIS_ACCESS_KEY_ID")
	secretKey := os.Getenv("TIGRIS_SECRET_ACCESS_KEY")
	endpoint := os.Getenv("TIGRIS_ENDPOINT_URL")

	if bucket == "" {
		return nil, fmt.Errorf("storage: TIGRIS_BUCKET is required")
	}
	if accessKey == "" {
		return nil, fmt.Errorf("storage: TIGRIS_ACCESS_KEY_ID is required")
	}
	if secretKey == "" {
		return nil, fmt.Errorf("storage: TIGRIS_SECRET_ACCESS_KEY is required")
	}
	if endpoint == "" {
		return nil, fmt.Errorf("storage: TIGRIS_ENDPOINT_URL is required")
	}

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")

	s3Client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		// Tigris uses path-style addressing
		UsePathStyle: true,
		// Region is required by the SDK even for S3-compatible services
		Region:      "auto",
		Credentials: creds,
	})

	return &Client{s3: s3Client, bucket: bucket}, nil
}

// Put uploads body to the given key with the specified content type.
func (c *Client) Put(ctx context.Context, key, contentType string, body io.Reader) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Body:        body,
	})
	if err != nil {
		return fmt.Errorf("storage: Put %q: %w", key, err)
	}
	return nil
}

// Get fetches the object at key. The caller must close the returned ReadCloser.
func (c *Client) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: Get %q: %w", key, err)
	}
	return out.Body, nil
}

// Delete removes the object at key from storage.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("storage: Delete %q: %w", key, err)
	}
	return nil
}

// KeyExists reports whether an object with the given key exists in storage.
func (c *Client) KeyExists(ctx context.Context, key string) (bool, error) {
	_, err := c.s3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		// Check for 404-style error
		var notFound *types.NotFound
		if isNotFound(err, &notFound) {
			return false, nil
		}
		return false, fmt.Errorf("storage: KeyExists %q: %w", key, err)
	}
	return true, nil
}

// isNotFound checks whether err is a NoSuchKey / NotFound S3 error.
func isNotFound(err error, target **types.NotFound) bool {
	// Use errors.As style check via the types package
	if err == nil {
		return false
	}
	// types.NotFound implements the smithy APIError interface
	var nf *types.NotFound
	if ok := asError(err, &nf); ok {
		*target = nf
		return true
	}
	// HeadObject may return a generic HTTP 404 without a typed error body
	return isHTTP404(err)
}

// asError attempts a type assertion to the target pointer type.
func asError[T error](err error, target *T) bool {
	if t, ok := err.(T); ok {
		*target = t
		return true
	}
	return false
}

// isHTTP404 checks for a smithy HTTP response with status 404.
func isHTTP404(err error) bool {
	type httpError interface {
		HTTPStatusCode() int
	}
	if he, ok := err.(httpError); ok {
		return he.HTTPStatusCode() == 404
	}
	return false
}
